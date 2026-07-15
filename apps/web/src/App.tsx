import { useEffect, useState } from 'react'

interface LessonResponse {
  lesson: {
    id: number
    title: string
    summary: string
    deepExplanation: string
    state: string
  }
  sections: Array<{ heading: string; body: string; position: number }>
  sources: Array<{ title: string; url: string; publisher: string; relevant_section: string }>
  quiz: { id: number; prompt: string; options: string[] } | null
}

export function App() {
  const [data, setData] = useState<LessonResponse | null>(null)
  const [view, setView] = useState<'lesson' | 'deep' | 'quiz' | 'feedback'>('lesson')
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/lessons/current')
      .then((response) => {
        if (!response.ok) throw new Error('The lesson could not be loaded.')
        return response.json() as Promise<LessonResponse>
      })
      .then(setData)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Something went wrong.'))
  }, [])

  async function chooseAction(action: 'understand' | 'review_later') {
    if (!data) return
    const response = await fetch(`/api/lessons/${data.lesson.id}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!response.ok) return setError('Your choice could not be saved.')
    if (action === 'understand') setView('quiz')
    else setError('Saved for later. Your main learning path can continue.')
  }

  async function answer(value: string) {
    if (!data?.quiz) return
    const response = await fetch(`/api/quizzes/${data.quiz.id}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer: value }),
    })
    if (!response.ok) return setError('Your answer could not be saved.')
    setFeedback(await response.json())
    setView('feedback')
  }

  if (error && !data) return <main><p role="alert">{error}</p></main>
  if (!data) return <main><p>Preparing today’s lesson…</p></main>

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
              <pre>{section.body.replace(/^```js\n|\n```$/g, '')}</pre>
            </section>
          ))}
          <section>
            <h2>Source</h2>
            {data.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                {source.title} — {source.publisher}
              </a>
            ))}
          </section>
          <div className="actions">
            <button className="primary" onClick={() => void chooseAction('understand')}>I understand</button>
            <button onClick={() => void chooseAction('review_later')}>Review later</button>
            <button onClick={() => setView('deep')}>Explain deeper</button>
          </div>
        </>
      )}

      {view === 'deep' && (
        <section>
          <h2>Follow the values</h2>
          <p className="lead">{data.lesson.deepExplanation}</p>
          <button onClick={() => setView('lesson')}>Back to lesson</button>
        </section>
      )}

      {view === 'quiz' && data.quiz && (
        <section>
          <h2>Check your understanding</h2>
          <p className="lead">{data.quiz.prompt}</p>
          <div className="choices">
            {data.quiz.options.map((option) => (
              <button key={option} onClick={() => void answer(option)}>{option}</button>
            ))}
            <button onClick={() => void chooseAction('review_later')}>I don’t know yet</button>
          </div>
        </section>
      )}

      {view === 'feedback' && feedback && (
        <section aria-live="polite">
          <h2>{feedback.correct ? 'That’s right.' : 'Not quite yet.'}</h2>
          <p className="lead">{feedback.explanation}</p>
        </section>
      )}

      {error && <p className="notice" role="status">{error}</p>}
    </main>
  )
}

