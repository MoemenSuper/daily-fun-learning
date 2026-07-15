INSERT OR REPLACE INTO learning_profiles (id, preferences_json)
VALUES (1, '{"distribution":{"priority":60,"core":25,"adjacent":15},"concreteExamples":true,"hiddenSteps":false,"codeLiteracyGoal":true,"gamification":false}');

INSERT OR IGNORE INTO topics (slug, name, category, weight)
VALUES ('javascript-async', 'Asynchronous JavaScript', 'priority', 60);

INSERT OR IGNORE INTO learning_paths (slug, title, phase, active)
VALUES ('async-javascript-theory', 'How asynchronous JavaScript really flows', 'theory', 1);

INSERT OR IGNORE INTO lessons (path_id, topic_id, slug, title, summary, deep_explanation, sequence, published)
SELECT p.id, t.id, 'functions-as-values', 'A function can be a value',
'In JavaScript, `greet` and `greet()` are different values. `greet` refers to the function object. `greet()` calls that object and evaluates to its return value. This is why another function can receive `greet` now and call it later.',
'Follow the two values separately. When JavaScript evaluates `run(greet)`, it looks up the function object stored under `greet` and passes that object into `run`. Inside `run`, the parameter now points to the same function object. Only the later expression `task()` invokes it. By contrast, `run(greet())` invokes `greet` first and passes its return value. The common mistake is reading both forms as “pass greet,” even though the parentheses change when execution occurs.',
1, 1
FROM learning_paths p, topics t
WHERE p.slug = 'async-javascript-theory' AND t.slug = 'javascript-async';

INSERT OR IGNORE INTO lesson_sections (lesson_id, heading, body, position)
SELECT id, 'Start with the exact values', '```js\nfunction greet() {\n  return "hello";\n}\n\nfunction run(task) {\n  return task();\n}\n\nrun(greet); // passes the function, then run calls it\n```', 1
FROM lessons WHERE slug = 'functions-as-values';

INSERT OR IGNORE INTO lesson_sections (lesson_id, heading, body, position)
SELECT id, 'Why this matters', 'Callbacks, event handlers, Promise continuations, and Express middleware all depend on passing behavior as a value so another piece of code can decide when to run it.', 2
FROM lessons WHERE slug = 'functions-as-values';

INSERT OR IGNORE INTO sources (lesson_id, title, url, publisher, source_type, relevant_section, verified_on, supported_claims)
SELECT id, 'Functions — reusable blocks of code', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions', 'MDN Web Docs', 'documentation', 'Using the arguments object and function expressions', '2026-07-15', 'JavaScript functions are objects and can be passed to other functions.'
FROM lessons WHERE slug = 'functions-as-values';

INSERT OR IGNORE INTO quiz_questions (lesson_id, prompt, kind, options_json, correct_answer, explanation)
SELECT id, 'What does `run(greet)` pass into `run`?', 'multiple_choice', '["The string returned by greet","The greet function object","The source-code text of greet"]', 'The greet function object', 'Without parentheses, `greet` evaluates to the function object. `greet()` would call it first and pass the returned string.'
FROM lessons WHERE slug = 'functions-as-values';

