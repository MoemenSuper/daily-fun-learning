import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { normalizeCodeBlock, QuizChoices } from './App'

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
})
