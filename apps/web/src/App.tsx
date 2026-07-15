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
  const [view, setView] = useState<'lesson' | 'deep' | 'quiz' | 'feedback'>('lesson')
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null)
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
      else setMessage('Saved for later. Your main learning path can continue.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Your choice could not be saved.')
    }
  }

  async function answer(value: string) {
    if (!data?.quiz) return
    try {
      const result = await requestJson<{ correct: boolean; explanation: string }>(
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
                <pre><code>{section.body.replace(/^```js\n|\n```$/g, '')}</code></pre>
              ) : (
                <p>{section.body}</p>
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
          <details open><summary>Start with the example</summary><pre><code>{data.sections[0]?.body.replace(/^```js\n|\n```$/g, '')}</code></pre></details>
          <details open><summary>Follow the values</summary><p>{data.lesson.deepExplanation}</p></details>
          <details><summary>Check your understanding</summary><p>{data.quiz?.prompt}</p></details>
          <button onClick={() => setView('lesson')}>Back to lesson</button>
        </section>
      )}
      {view === 'quiz' && data.quiz && <QuizChoices quiz={data.quiz} onAnswer={answer} onUnknown={() => void chooseAction('review_later')} />}
      {view === 'feedback' && feedback && <Feedback feedback={feedback} />}
      {message && <p className="notice" role="status">{message}</p>}
    </main>
  )
}

function ReviewLater() {
  interface Review { id: number; title: string; summary: string; topic: string; reason: string }
  const [reviews, setReviews] = useState<Review[]>([])
  const [topic, setTopic] = useState('all')
  const [selected, setSelected] = useState<{ lesson: { id: number; title: string; summary: string; deepExplanation: string }; quiz: Quiz | null } | null>(null)
  const [quizActive, setQuizActive] = useState(false)
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null)
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
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null)
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
  interface Preferences { distribution: { priority: number; core: number; adjacent: number }; concreteExamples: boolean; explainCausalSteps: boolean; clarityOverBrevity: boolean; codeLiteracyGoal: boolean; gamification: false }
  const [hour, setHour] = useState(8)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [message, setMessage] = useState('Loading profile…')

  useEffect(() => {
    requestJson<{ notificationHour: number; preferences: Preferences }>('/api/profile').then((body) => { setHour(body.notificationHour); setPreferences(body.preferences); setMessage('') }).catch((error: Error) => setMessage(error.message))
  }, [])

  async function save() {
    if (!preferences) return
    await requestJson('/api/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notificationHour: hour, preferences }) })
    setMessage('Profile saved.')
  }

  if (!preferences) return <PageMessage message={message} />
  return <main><p className="eyebrow">Profile</p><h1>How this guide teaches</h1><p className="lead">The curriculum favors current priorities while keeping core computer science and useful adjacent discoveries in view.</p><div className="form-grid"><label>Notification hour<input type="number" min="0" max="23" value={hour} onChange={(event) => setHour(Number(event.target.value))} /></label>{Object.entries(preferences.distribution).map(([key, value]) => <label key={key}>{key}<input type="number" min="0" max="100" value={value} onChange={(event) => setPreferences({ ...preferences, distribution: { ...preferences.distribution, [key]: Number(event.target.value) } })} /></label>)}</div><p>Topic percentages must total 100. Concrete examples, causal steps, readable depth, and code literacy remain enabled; gamification remains off.</p><button className="primary" onClick={() => void save()}>Save profile</button>{message && <p className="notice">{message}</p>}</main>
}

function QuizChoices({ quiz, onAnswer, onUnknown }: { quiz: Quiz; onAnswer: (value: string) => Promise<void>; onUnknown?: () => void }) {
  return <section><h2>Check your understanding</h2><p className="lead">{quiz.prompt}</p><div className="choices">{quiz.options.map((option) => <button key={option} onClick={() => void onAnswer(option)}>{option}</button>)}{onUnknown && <button onClick={onUnknown}>I don’t know yet</button>}</div></section>
}

function Feedback({ feedback }: { feedback: { correct: boolean; explanation: string } }) {
  return <section aria-live="polite"><h2>{feedback.correct ? 'That’s right.' : 'Not quite yet.'}</h2><p className="lead">{feedback.explanation}</p></section>
}

function SourceList({ sources }: { sources: LessonResponse['sources'] }) {
  return <section><h2>Source</h2>{sources.map((source) => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} — {source.publisher}</a><br /><small>{source.relevant_section}</small></p>)}</section>
}

function PageMessage({ title, message }: { title?: string; message: string }) {
  return <main>{title && <><p className="eyebrow">{title}</p><h1>{title}</h1></>}<p className="lead" role="status">{message}</p></main>
}
