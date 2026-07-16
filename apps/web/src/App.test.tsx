import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DeepExplanation, normalizeCodeBlock, parseDeepExplanation, QuizChoices } from './App'

describe('lesson interaction and formatting', () => {
  it('normalizes escaped Markdown code into real lines without fences', () => {
    const stored = '```js\\nfunction run(task) { return task(); }\\nrun(sayHi);\\n```'

    expect(normalizeCodeBlock(stored)).toBe(
      'function run(task) { return task(); }\nrun(sayHi);',
    )
  })

  it('renders answer selection separately from checking the answer', () => {
    const markup = renderToStaticMarkup(
      <QuizChoices
        quiz={{ id: 2, prompt: 'What does task hold?', options: ['A name', 'A function'] }}
        onAnswer={async () => undefined}
      />,
    )

    expect(markup).toContain('type="radio"')
    expect(markup).toContain('Check answer')
  })

  it('splits a deep explanation into readable disclosure sections', () => {
    const stored = 'Follow the execution\nFirst paragraph.\n\nCommon mistake\nSecond paragraph.'

    expect(parseDeepExplanation(stored)).toEqual([
      { heading: 'Follow the execution', body: 'First paragraph.' },
      { heading: 'Common mistake', body: 'Second paragraph.' },
    ])

    const markup = renderToStaticMarkup(<DeepExplanation text={stored} />)
    expect(markup).toContain('<summary>Follow the execution</summary>')
    expect(markup).toContain('<summary>Common mistake</summary>')
  })
})
