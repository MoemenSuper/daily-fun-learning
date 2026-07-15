import { useEffect, useMemo, useState } from 'react'

interface LessonResponse {
  lesson: { id: number; title: string; summary: string; deepExplanation: string; state: string }
  sections: Array<{ heading: string; body: string; position: number }>
  sources: Array<{ title: string; url: string; publisher: string; relevant_section: string }>
  quiz: Quiz | null
}

interface Quiz {
  id: number
  prompt: string
  options: string[]
}

interface QuizFeedback {
  correct: boolean
  correctAnswer: string
  explanation: string
}

type Page = 'today' | 'reviews' | 'weekly' | 'profile'

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'The request could not be completed.')
  }
  return response.json() as Promise<T>
}

export function App() {
  const [page, setPage] = useState<Page>('today')

  return (
    <>
      <nav aria-label="Learning guide">
        <span className="brand">Daily Learning</span>
        {([
          ['today', 'Today'],
          ['reviews', 'Review later'],
          ['weekly', 'Weekly review'],
          ['profile', 'Profile'],
        ] as Array<[Page, string]>).map(([value, label]) => (
          <button className={page === value ? 'nav-active' : ''} key={value} onClick={() => setPage(value)}>
            {label}
          </button>
        ))}
      </nav>
      {page === 'today' && <TodayLesson />}
      {page === 'reviews' && <ReviewLater />}
      {page === 'weekly' && <WeeklyReview />}
      {page === 'profile' && <Profile />}
    </>
  )
}

function TodayLesson() {
  const [data, setData] = useState<LessonResponse | null>(null)
  const [view, setView] = useState<'lesson' | 'deep' | 'quiz' | 'feedback' | 'saved'>('lesson')
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    requestJson<LessonResponse>('/api/lessons/current').then(setData).catch((error: Error) => setMessage(error.message))
  }, [])

  async function chooseAction(action: 'understand' | 'review_later') {
    if (!data) return
    try {
      await requestJson(`/api/lessons/${data.lesson.id}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (action === 'understand') setView('quiz')
      else {
        setMessage('Saved for later. Your main learning path can continue.')
        setView('saved')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Your choice could not be saved.')
    }
  }

  async function answer(value: string) {
    if (!data?.quiz) return
    try {
      if (view === 'deep') {
        await requestJson(`/api/lessons/${data.lesson.id}/action`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'understand' }),
        })
      }
      const result = await requestJson<QuizFeedback>(
        `/api/quizzes/${data.quiz.id}/answer`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ answer: value }),
        },
      )
      setFeedback(result)
      setView('feedback')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Your answer could not be saved.')
    }
  }

  if (!data) return <PageMessage message={message || 'Preparing today’s lesson…'} />

  return (
    <main>
      <p className="eyebrow">Today’s lesson</p>
      <h1>{data.lesson.title}</h1>
      {view === 'lesson' && (
        <>
          <p className="lead">{data.lesson.summary}</p>
          {data.sections.map((section) => (
            <section key={section.position}>
              <h2>{section.heading}</h2>
              {section.position === 1 ? (
                <CodeBlock code={normalizeCodeBlock(section.body)} />
              ) : (
                <p><InlineCode text={section.body} /></p>
              )}
            </section>
          ))}
          <SourceList sources={data.sources} />
          <div className="actions">
            <button className="primary" onClick={() => void chooseAction('understand')}>I understand</button>
            <button onClick={() => void chooseAction('review_later')}>Review later</button>
            <button onClick={() => setView('deep')}>Explain deeper</button>
            {data.sources[0] && <a className="button-link" href={data.sources[0].url} target="_blank" rel="noreferrer">Open source</a>}
          </div>
        </>
      )}
      {view === 'deep' && (
        <section className="deep-sections">
          <details open><summary>Start with the example</summary><CodeBlock code={normalizeCodeBlock(data.sections[0]?.body ?? '')} /></details>
          <details open><summary>Follow the values</summary><p><InlineCode text={data.lesson.deepExplanation} /></p></details>
          <details open>
            <summary>Check your understanding</summary>
            {data.quiz
              ? <QuizChoices quiz={data.quiz} onAnswer={answer} onUnknown={() => void chooseAction('review_later')} compact />
              : <p>No comprehension question is available for this lesson.</p>}
          </details>
          <button onClick={() => setView('lesson')}>Back to lesson</button>
        </section>
      )}
      {view === 'quiz' && data.quiz && <QuizChoices quiz={data.quiz} onAnswer={answer} onUnknown={() => void chooseAction('review_later')} />}
      {view === 'feedback' && feedback && <Feedback feedback={feedback} />}
      {view === 'saved' && <section><h2>No pressure.</h2><p className="lead">This lesson is waiting in Review later. The next daily lesson is still available on schedule.</p></section>}
      {message && view !== 'saved' && <p className="notice" role="status">{message}</p>}
    </main>
  )
}

function ReviewLater() {
  interface Review { id: number; title: string; summary: string; topic: string; reason: string }
  const [reviews, setReviews] = useState<Review[]>([])
  const [topic, setTopic] = useState('all')
  const [selected, setSelected] = useState<{ lesson: { id: number; title: string; summary: string; deepExplanation: string }; quiz: Quiz | null } | null>(null)
  const [quizActive, setQuizActive] = useState(false)
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null)
  const [message, setMessage] = useState('Loading saved lessons…')

  useEffect(() => {
    requestJson<{ reviews: Review[] }>('/api/reviews/later')
      .then((body) => { setReviews(body.reviews); setMessage('') })
      .catch((error: Error) => setMessage(error.message))
  }, [])

  const topics = useMemo(() => Array.from(new Set(reviews.map((review) => review.topic))), [reviews])
  const visible = topic === 'all' ? reviews : reviews.filter((review) => review.topic === topic)

  async function openReview(id: number) {
    try {
      setSelected(await requestJson(`/api/reviews/${id}`))
      setQuizActive(false)
      setFeedback(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The review could not be opened.')
    }
  }

  async function startQuiz() {
    if (!selected) return
    await requestJson(`/api/reviews/${selected.lesson.id}/start`, { method: 'POST' })
    setQuizActive(true)
  }

  async function answer(value: string) {
    if (!selected?.quiz) return
    setFeedback(await requestJson(`/api/quizzes/${selected.quiz.id}/answer`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answer: value }),
    }))
    setQuizActive(false)
  }

  if (selected) return (
    <main>
      <button onClick={() => setSelected(null)}>← Review list</button>
      <p className="eyebrow">Saved lesson</p><h1>{selected.lesson.title}</h1>
      <p className="lead">{selected.lesson.summary}</p>
      <details><summary>Deep explanation</summary><p>{selected.lesson.deepExplanation}</p></details>
      {!quizActive && !feedback && <button className="primary" onClick={() => void startQuiz()}>Retake quiz</button>}
      {quizActive && selected.quiz && <QuizChoices quiz={selected.quiz} onAnswer={answer} />}
      {feedback && <Feedback feedback={feedback} />}
    </main>
  )

  return (
    <main>
      <p className="eyebrow">Review later</p><h1>Saved lessons</h1>
      {topics.length > 1 && <label>Topic <select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All topics</option>{topics.map((value) => <option key={value}>{value}</option>)}</select></label>}
      {visible.map((review) => <article className="list-item" key={review.id}><div><p className="eyebrow">{review.topic} · {review.reason.replaceAll('_', ' ')}</p><h2>{review.title}</h2><p>{review.summary}</p></div><button onClick={() => void openReview(review.id)}>Open</button></article>)}
      {message && <p>{message}</p>}
      {!message && visible.length === 0 && <p>Nothing is waiting for review.</p>}
    </main>
  )
}

function WeeklyReview() {
  interface Weekly { available: boolean; reviewId?: number; completedCount: number; questions?: Array<Quiz & { title: string }> }
  const [review, setReview] = useState<Weekly | null>(null)
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null)
  const [message, setMessage] = useState('Checking review eligibility…')

  useEffect(() => {
    requestJson<Weekly>('/api/weekly-review').then((body) => { setReview(body); setMessage('') }).catch((error: Error) => setMessage(error.message))
  }, [])

  async function answer(value: string) {
    const question = review?.questions?.[index]
    if (!question || !review?.reviewId) return
    setFeedback(await requestJson(`/api/weekly-review/${review.reviewId}/questions/${question.id}/answer`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answer: value }),
    }))
  }

  async function next() {
    if (!review?.questions || !review.reviewId) return
    if (index + 1 < review.questions.length) { setIndex(index + 1); setFeedback(null); return }
    await requestJson(`/api/weekly-review/${review.reviewId}/complete`, { method: 'POST' })
    setReview({ ...review, available: false })
  }

  if (!review) return <PageMessage message={message} />
  if (!review.available) return <PageMessage title="Weekly review" message={`No review is due yet. You have completed ${review.completedCount} lessons.`} />
  const question = review.questions?.[index]
  return <main><p className="eyebrow">Optional weekly review</p><h1>A short look back</h1>{question && !feedback && <><p>{question.title}</p><QuizChoices quiz={question} onAnswer={answer} /></>}{feedback && <><Feedback feedback={feedback} /><button className="primary" onClick={() => void next()}>Next</button></>}</main>
}

function Profile() {
  interface Preferences {
    distribution: { priority: number; core: number; adjacent: number }
    concreteExamples: boolean
    explainCausalSteps: boolean
    clarityOverBrevity: boolean
    avoidInformationOverload: boolean
    codeLiteracyGoal: boolean
    codeNavigationGoal: boolean
    userControl: boolean
    noStreaks: true
    gamification: false
  }
  interface Topic { slug: string; name: string; category: 'priority' | 'core' | 'adjacent'; weight: number }
  const [hour, setHour] = useState(8)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [message, setMessage] = useState('Loading profile…')

  useEffect(() => {
    requestJson<{ notificationHour: number; preferences: Preferences; topics: Topic[] }>('/api/profile')
      .then((body) => { setHour(body.notificationHour); setPreferences(body.preferences); setTopics(body.topics); setMessage('') })
      .catch((error: Error) => setMessage(error.message))
  }, [])

  async function save() {
    if (!preferences) return
    try {
      await requestJson('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notificationHour: hour,
          preferences,
          topics: topics.map(({ slug, weight }) => ({ slug, weight })),
        }),
      })
      setMessage('Profile saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The profile could not be saved.')
    }
  }

  if (!preferences) return <PageMessage message={message} />
  const editablePreferences = [
    ['concreteExamples', 'Require concrete examples'],
    ['explainCausalSteps', 'Explain hidden causal steps'],
    ['clarityOverBrevity', 'Prefer clarity over extreme brevity'],
    ['avoidInformationOverload', 'Avoid information overload'],
    ['codeLiteracyGoal', 'Prioritize code literacy'],
    ['codeNavigationGoal', 'Practice navigating unfamiliar code'],
    ['userControl', 'Keep the learner in control'],
  ] as const

  return (
    <main>
      <p className="eyebrow">Profile</p>
      <h1>How this guide teaches</h1>
      <p className="lead">The curriculum favors current priorities while keeping core computer science and useful adjacent discoveries in view.</p>
      <div className="form-grid">
        <label>Notification hour<input type="number" min="0" max="23" value={hour} onChange={(event) => setHour(Number(event.target.value))} /></label>
        {Object.entries(preferences.distribution).map(([key, value]) => (
          <label key={key}>{key}<input type="number" min="0" max="100" value={value} onChange={(event) => setPreferences({ ...preferences, distribution: { ...preferences.distribution, [key]: Number(event.target.value) } })} /></label>
        ))}
      </div>
      <details>
        <summary>Teaching preferences</summary>
        <div className="preference-list">
          {editablePreferences.map(([key, label]) => (
            <label className="check-label" key={key}>
              <input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <p>Streaks and gamification remain disabled.</p>
      </details>
      <details>
        <summary>Edit topic priorities</summary>
        {(['priority', 'core', 'adjacent'] as const).map((category) => (
          <section key={category}>
            <h2>{category}</h2>
            <div className="topic-grid">
              {topics.filter((topic) => topic.category === category).map((topic) => (
                <label key={topic.slug}>{topic.name}<input type="number" min="0" max="100" value={topic.weight} onChange={(event) => setTopics(topics.map((candidate) => candidate.slug === topic.slug ? { ...candidate, weight: Number(event.target.value) } : candidate))} /></label>
              ))}
            </div>
          </section>
        ))}
      </details>
      <p>Category percentages must total 100, and topic weights within each category must match its percentage.</p>
      <button className="primary" onClick={() => void save()}>Save profile</button>
      {message && <p className="notice">{message}</p>}
    </main>
  )
}

export function QuizChoices({ quiz, onAnswer, onUnknown, compact = false }: { quiz: Quiz; onAnswer: (value: string) => Promise<void>; onUnknown?: () => void; compact?: boolean }) {
  const [selected, setSelected] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || submitting) return
    setSubmitting(true)
    try {
      await onAnswer(selected)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={`quiz-card${compact ? ' quiz-card-compact' : ''}`}>
      {!compact && <h2>Check your understanding</h2>}
      <form onSubmit={(event) => void submit(event)}>
        <fieldset>
          <legend><InlineCode text={quiz.prompt} /></legend>
          <div className="choices">
            {quiz.options.map((option) => (
              <label className={`choice${selected === option ? ' choice-selected' : ''}`} key={option}>
                <input
                  checked={selected === option}
                  name={`quiz-${quiz.id}`}
                  onChange={() => setSelected(option)}
                  type="radio"
                  value={option}
                />
                <span><InlineCode text={option} /></span>
              </label>
            ))}
          </div>
          <div className="quiz-actions">
            <button className="primary" disabled={!selected || submitting} type="submit">
              {submitting ? 'Checking…' : 'Check answer'}
            </button>
            {onUnknown && <button onClick={onUnknown} type="button">I don’t know yet</button>}
          </div>
        </fieldset>
      </form>
    </section>
  )
}

export function normalizeCodeBlock(code: string) {
  const withRealLines = code.includes('\\n') && !code.includes('\n')
    ? code.replaceAll('\\n', '\n')
    : code.replaceAll('\r\n', '\n')
  return withRealLines
    .replace(/^```(?:js|javascript)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}

function Feedback({ feedback }: { feedback: QuizFeedback }) {
  return <section className={`feedback ${feedback.correct ? 'feedback-correct' : 'feedback-review'}`} aria-live="polite"><p className="feedback-label">{feedback.correct ? 'Correct' : 'Take another look'}</p><h2>{feedback.correct ? 'That’s right.' : 'Not quite yet.'}</h2><p className="correct-answer"><strong>Correct answer:</strong> <InlineCode text={feedback.correctAnswer} /></p><p>{feedback.explanation}</p></section>
}

function InlineCode({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/g).filter(Boolean).map((part, index) => (
    part.startsWith('`') && part.endsWith('`')
      ? <code className="inline-code" key={index}>{part.slice(1, -1)}</code>
      : <span key={index}>{part}</span>
  ))}</>
}

function SourceList({ sources }: { sources: LessonResponse['sources'] }) {
  return <section><h2>Source</h2>{sources.map((source) => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} — {source.publisher}</a><br /><small>{source.relevant_section}</small></p>)}</section>
}

function PageMessage({ title, message }: { title?: string; message: string }) {
  return <main>{title && <><p className="eyebrow">{title}</p><h1>{title}</h1></>}<p className="lead" role="status">{message}</p></main>
}

function CodeBlock({ code, emphasizedLines = [] }: { code: string; emphasizedLines?: number[] }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>JavaScript</span>
        <button className="copy-code" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <pre aria-label="JavaScript example"><code>{code.split('\n').map((line, index) => (
        <span className={`code-line${emphasizedLines.includes(index + 1) ? ' emphasized' : ''}`} key={index}>
          <span className="line-number" aria-hidden="true">{index + 1}</span>
          <span>{highlightJavaScript(line)}</span>
        </span>
      ))}</code></pre>
    </div>
  )
}

function highlightJavaScript(line: string) {
  const tokens = line.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*|\b(?:async|await|const|let|function|return|new|throw|try|catch)\b)/g)
  return tokens.map((token, index) => {
    const className = token.startsWith('//')
      ? 'token-comment'
      : /^['"`]/.test(token)
        ? 'token-string'
        : /^(async|await|const|let|function|return|new|throw|try|catch)$/.test(token)
          ? 'token-keyword'
          : undefined
    return <span className={className} key={index}>{token}</span>
  })
}
