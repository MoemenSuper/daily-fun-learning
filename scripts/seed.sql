INSERT OR REPLACE INTO learning_profiles (id, preferences_json)
VALUES (1, '{"distribution":{"priority":60,"core":25,"adjacent":15},"concreteExamples":true,"explainCausalSteps":true,"clarityOverBrevity":true,"avoidInformationOverload":true,"codeLiteracyGoal":true,"codeNavigationGoal":true,"userControl":true,"noStreaks":true,"gamification":false}');

INSERT INTO topics (slug, name, category, weight) VALUES
  ('rag', 'RAG', 'priority', 8),
  ('embeddings', 'Embeddings', 'priority', 6),
  ('vector-databases', 'Vector databases', 'priority', 5),
  ('neo4j', 'Neo4j', 'priority', 4),
  ('graphrag', 'GraphRAG', 'priority', 5),
  ('python', 'Python', 'priority', 5),
  ('fastapi', 'FastAPI', 'priority', 4),
  ('rest-apis', 'REST APIs', 'priority', 4),
  ('http', 'HTTP and web API behavior', 'priority', 4),
  ('express', 'Express', 'priority', 4),
  ('nodejs', 'Node.js', 'priority', 3),
  ('javascript-async', 'JavaScript asynchronous programming', 'priority', 4),
  ('functions-as-values', 'Functions passed as values', 'priority', 1),
  ('callbacks', 'Callback functions', 'priority', 1),
  ('promises', 'Promises', 'priority', 1),
  ('async-await', 'async and await', 'priority', 1),
  ('node-express', 'Node.js and Express practice', 'priority', 0),
  ('databases', 'Databases', 'core', 4),
  ('networking', 'Networking', 'core', 4),
  ('git', 'Git', 'core', 3),
  ('java', 'Java', 'core', 3),
  ('architecture', 'Software architecture', 'core', 4),
  ('operating-systems', 'Operating systems', 'core', 3),
  ('security', 'Security', 'core', 2),
  ('algorithms', 'Algorithms', 'core', 2),
  ('compilers', 'Compilers', 'adjacent', 4),
  ('distributed-systems', 'Distributed systems', 'adjacent', 4),
  ('web-standards', 'Web standards', 'adjacent', 4),
  ('observability', 'Observability', 'adjacent', 3)
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  category = excluded.category,
  weight = excluded.weight;

INSERT OR IGNORE INTO learning_paths (slug, title, phase, active) VALUES
  ('async-javascript-theory', 'How asynchronous JavaScript really flows', 'theory', 1),
  ('async-javascript-practice', 'Reading asynchronous JavaScript in real code', 'practice', 0);

DROP TABLE IF EXISTS seed_lessons;

CREATE TABLE seed_lessons (
  sequence INTEGER,
  phase TEXT,
  slug TEXT,
  title TEXT,
  summary TEXT,
  deep_explanation TEXT,
  example TEXT,
  source_title TEXT,
  source_url TEXT,
  publisher TEXT,
  relevant_section TEXT,
  quiz_prompt TEXT,
  options_json TEXT,
  correct_answer TEXT,
  answer_explanation TEXT
);

INSERT INTO seed_lessons VALUES
(1, 'theory', 'functions-as-values', 'A function can be a value',
'In JavaScript, `greet` and `greet()` are different values. `greet` refers to the function object. `greet()` calls that object and evaluates to its return value. This is why another function can receive `greet` now and call it later.',
'Follow the two values separately. When JavaScript evaluates `run(greet)`, it looks up the function object stored under `greet` and passes that object into `run`. Inside `run`, the parameter points to the same function. Only `task()` invokes it. In `run(greet())`, the parentheses invoke `greet` first, so `run` receives the returned string instead. This ability to pass behavior is the base mechanism behind callbacks, middleware, and Promise handlers.',
'function greet() { return "hello"; }\nfunction run(task) { return task(); }\nrun(greet);',
'Functions', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions', 'MDN Web Docs', 'Function expressions and calling functions',
'What does `run(greet)` pass into `run`?', '["The string returned by greet","The greet function object","The source-code text of greet"]', 'The greet function object',
'Without parentheses, `greet` evaluates to the function object. `greet()` would call it first and pass the returned string.'),

(2, 'theory', 'parameters-hold-values', 'A parameter receives the passed value',
'In `run(greet)`, `task` is not a special callback variable. It is an ordinary parameter whose value happens to be a function object. Renaming it to `banana` changes no behavior.',
'At call time, JavaScript evaluates each argument expression and assigns the resulting values to the function parameters. The parameter name belongs to the called function; it does not need to match the variable name at the call site. When the body evaluates `task()`, JavaScript reads the value in `task` and invokes it. The important question is always: what value entered this parameter?',
'function run(task) { return task(); }\nconst sayHi = () => "hi";\nrun(sayHi);',
'Functions', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions', 'MDN Web Docs', 'Function parameters',
'Inside `run`, what value does `task` hold?', '["The name sayHi","The same function object referenced by sayHi","The result hi"]', 'The same function object referenced by sayHi',
'Arguments are evaluated and their values are assigned to parameters. Here that value is the function object.'),

(3, 'theory', 'callbacks-defer-control', 'A callback gives another function control over timing',
'Passing `onDone` into `loadData` does not promise that it runs immediately. `loadData` owns the call site, so it decides whether to invoke the callback now, later, once, many times, or never.',
'A callback is defined by control flow, not syntax. First the caller creates or references a function. Then it passes that function as an argument. The receiving API stores or invokes it according to that API contract. With `setTimeout`, the timer system waits until the delay has elapsed and a later event-loop turn can run the callback. Reading callbacks means locating the eventual invocation, not only the place where the function was passed.',
'setTimeout(() => console.log("later"), 1000);\nconsole.log("now");',
'Callback function', 'https://developer.mozilla.org/en-US/docs/Glossary/Callback_function', 'MDN Web Docs', 'Callback function definition',
'Who decides when the callback passed to `setTimeout` is called?', '["The callback itself","The `setTimeout` API and runtime","The variable name"]', 'The `setTimeout` API and runtime',
'The receiving API owns the invocation. The callback only describes what should happen when invoked.'),

(4, 'theory', 'run-to-completion', 'JavaScript finishes the current job first',
'A timer becoming ready does not interrupt a function halfway through. The current JavaScript job runs to completion; only then can the event loop select another queued job.',
'JavaScript execution uses a stack for active function calls and queues for work that can start later. While the stack contains the current job, a timer callback may become eligible, but it cannot jump onto the stack. After the current job returns and the stack empties, the event loop chooses queued work. This run-to-completion rule makes local synchronous reasoning possible: ordinary code is not interrupted between two adjacent statements by an unrelated callback.',
'setTimeout(() => console.log("timer"), 0);\nfor (let i = 0; i < 1000000; i++) {}\nconsole.log("loop done");',
'JavaScript execution model', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model', 'MDN Web Docs', 'Run-to-completion',
'Can the timer callback interrupt the `for` loop?', '["Yes, after zero milliseconds","No, the current job must finish","Only in Node.js"]', 'No, the current job must finish',
'A ready callback waits until the active JavaScript job completes and the call stack becomes available.'),

(5, 'theory', 'tasks-and-microtasks', 'Promise handlers use the microtask queue',
'After synchronous code finishes, Promise reactions run before the event loop takes the next ordinary task such as a timer callback. That is why a resolved Promise often logs before `setTimeout(..., 0)`.',
'The host event loop selects a task, runs it to completion, and then performs a microtask checkpoint. Promise reaction jobs enter the microtask queue. During the checkpoint, the runtime drains microtasks before selecting the next task. A microtask can enqueue another microtask, so excessive chaining can delay timers and rendering. The simplified rule is synchronous code, then queued Promise reactions, then the next timer task; the HTML standard defines the fuller host algorithm.',
'setTimeout(() => console.log("task"), 0);\nPromise.resolve().then(() => console.log("microtask"));\nconsole.log("sync");',
'HTML Standard: Event loops', 'https://html.spec.whatwg.org/multipage/webappapis.html#event-loops', 'WHATWG', 'Event loops and microtask queue',
'Which usually logs first after `sync`?', '["task","microtask","They are random"]', 'microtask',
'Promise reactions are microtasks, and the runtime drains microtasks before selecting the next timer task.'),

(6, 'theory', 'promises-represent-outcomes', 'A Promise represents a future outcome',
'A Promise is an object you receive immediately, even when the underlying result is not ready. It moves from pending to fulfilled or rejected, and registered handlers react to that settled outcome.',
'Calling a Promise-returning function starts or requests work and immediately returns a Promise object. `.then` does not repeatedly inspect that object. It registers reactions with the Promise machinery and returns a new Promise, which is why chains can transform values and propagate failures. Once settled, a Promise keeps its outcome; attaching a handler later still schedules the appropriate reaction. The Promise is not the eventual value itself, and logging it is different from awaiting its result.',
'const resultPromise = fetch("/api/item");\nresultPromise.then(response => response.json());',
'Promise', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise', 'MDN Web Docs', 'Description and Promise states',
'What value does `fetch` return immediately?', '["The final JSON object","A Promise","Nothing until the network finishes"]', 'A Promise',
'The Promise is available immediately and later settles according to the network operation.'),

(7, 'theory', 'async-await-suspends-function', '`await` suspends one async function',
'When an async function reaches `await`, that function pauses and returns control to its caller. The JavaScript thread is not blocked; other work can run before the function continuation resumes.',
'An async function always returns a Promise. At `await expression`, JavaScript converts the expression to a Promise-like outcome, saves the continuation of the async function, and returns from that function for now. When the awaited Promise settles, the continuation is queued as a microtask. Code after the `await` therefore runs later. The common misconception is that `await` blocks the whole process; it only suspends the async function that contains it.',
'async function load() {\n  const response = await fetch("/api/item");\n  return response.json();\n}\nconst pending = load();',
'async function', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function', 'MDN Web Docs', 'Description',
'What does calling `load()` return before `fetch` finishes?', '["A Promise","The response object","It blocks and returns nothing"]', 'A Promise',
'Every async function call returns a Promise. `await` suspends that function rather than blocking the JavaScript thread.'),

(8, 'practice', 'predict-event-loop-output', 'Predict Node.js event-loop output',
'Trace the synchronous log first, then Promise microtasks, then timer work. The exercise is not about memorizing a slogan; it is about naming which queue receives each continuation.',
'Start with the active script job. It schedules one timer callback and one Promise reaction, then prints `A`. When the script job ends, Node processes the Promise reaction before the timers phase callback, so the observed order is A, C, B. Real Node.js has multiple event-loop phases, but this small example needs only the distinction between the current job, microtasks, and timers.',
'setTimeout(() => console.log("B"), 0);\nPromise.resolve().then(() => console.log("C"));\nconsole.log("A");',
'The Node.js Event Loop', 'https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick', 'Node.js', 'Event loop phases',
'What is the output order?', '["A, B, C","A, C, B","C, A, B"]', 'A, C, B',
'The script prints A synchronously. The Promise reaction is a microtask, so C runs before the timer prints B.'),

(9, 'practice', 'read-express-route', 'Read an Express route from request to response',
'In `app.get("/users/:id", handler)`, Express stores a route definition. For a matching GET request it builds `req` and `res`, calls `handler`, and `res.json` writes the HTTP response.',
'Read the route in four passes: HTTP method, path pattern, handler parameters, and response-producing call. `req.params.id` comes from the `:id` path segment; it is not a database value until your handler uses it in a query. `res.json(user)` serializes the selected value and ends the response. If the asynchronous lookup rejects, control must reach error handling rather than silently leaving the request open.',
'app.get("/users/:id", async (req, res) => {\n  const user = await users.find(req.params.id);\n  res.json(user);\n});',
'Express routing', 'https://expressjs.com/en/guide/routing/', 'Express.js', 'Route methods and route parameters',
'Where does `req.params.id` come from?', '["The JSON request body","The `:id` segment of the matched URL","The database"]', 'The `:id` segment of the matched URL',
'Express extracts the value from the path segment matched by `:id` and places it in `req.params`.'),

(10, 'practice', 'trace-middleware-next', 'Trace `next()` through middleware',
'Express middleware receives `req`, `res`, and `next`. Calling `next()` transfers control to the next matching layer. Omitting it is valid only when the current middleware finishes the response or handles the error.',
'Each middleware layer gets a chance to inspect or change the same request and response objects. A logger runs, calls `next`, and pauses while downstream code runs. If it has statements after `next()`, those execute when downstream control returns, which can create an onion-like order. A middleware that neither sends a response nor calls `next` leaves the request pending. `next(error)` follows the error-handling path instead of the ordinary stack.',
'app.use((req, res, next) => {\n  console.log("before");\n  next();\n  console.log("after");\n});',
'Using Express middleware', 'https://expressjs.com/en/guide/using-middleware/', 'Express.js', 'Application-level middleware',
'What must middleware do if it does not send a response?', '["Return the request","Call `next()`","Create a new app"]', 'Call `next()`',
'Calling `next()` lets Express continue to the next matching middleware or route handler.'),

(11, 'practice', 'convert-callback-to-promise', 'Compare callback and Promise file reads',
'Both examples request the same file read. The callback API puts success and failure in callback arguments; the Promise API returns an object that `await` can settle into a value or throw as an exception.',
'With `fs.readFile(path, callback)`, Node later invokes the callback with an error-first pair. With `fs.promises.readFile(path)`, Node returns a Promise. Awaiting it suspends the current async function, then resumes with the file data or throws the rejection. The Promise form changes how continuation and error propagation are expressed; it does not make the file operation synchronous or remove the underlying asynchronous work.',
'const text = await fs.promises.readFile("notes.txt", "utf8");\nconsole.log(text);',
'Node.js file system promises API', 'https://nodejs.org/api/fs.html#promises-api', 'Node.js', 'Promises API',
'Does `await readFile` make the file operation synchronous?', '["Yes","No, it suspends only the async function","Only on Windows"]', 'No, it suspends only the async function',
'The I/O remains asynchronous. `await` changes how that async function pauses and resumes.'),

(12, 'practice', 'find-sequential-await', 'Spot accidental sequential awaits',
'Two independent requests awaited one after another take roughly the sum of both waits. Starting both operations first and then using `Promise.all` allows their waiting periods to overlap.',
'In the sequential form, the second fetch does not start until the first Promise has fulfilled. If neither result depends on the other, that ordering adds latency without adding correctness. `Promise.all([fetchA(), fetchB()])` evaluates both calls immediately and returns one Promise for both outcomes. This is concurrency, not parallel JavaScript execution: the external operations overlap while their JavaScript continuations still run through the event loop.',
'const [user, posts] = await Promise.all([\n  fetchUser(),\n  fetchPosts(),\n]);',
'await operator', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await', 'MDN Web Docs', 'Improving performance by lowering promise chain dependency',
'When should two operations use `Promise.all`?', '["When the second needs the first result","When they are independent and may overlap","For every Promise"]', 'When they are independent and may overlap',
'Independent operations can start together. Dependent operations must preserve their required order.'),

(13, 'practice', 'diagnose-express-error', 'Route rejected Promises into Express error handling',
'An asynchronous route can fail after returning control to Express. The failure must reach error-handling middleware so the request gets a deliberate response instead of hanging or exposing internal details.',
'Express error middleware has four parameters: `err`, `req`, `res`, and `next`. In current Express, rejected Promises returned by route handlers are forwarded to error handling. In callback-based APIs, code must still call `next(error)` explicitly. The error handler should log appropriate internal context and send a stable external response. It must not leak stack traces to unauthenticated clients.',
'app.use((err, req, res, next) => {\n  console.error(err);\n  res.status(500).json({ error: "Internal error" });\n});',
'Express error handling', 'https://expressjs.com/en/guide/error-handling/', 'Express.js', 'Catching errors',
'What distinguishes Express error middleware?', '["It has four parameters","It must use async","It has no response object"]', 'It has four parameters',
'Express recognizes error-handling middleware by the four-parameter signature `err, req, res, next`.'),

(14, 'practice', 'navigate-express-source', 'Follow a real Express response method',
'Read `lib/response.js` in the Express repository and locate `res.json`. Follow the value from the method argument through JSON serialization to the call that sends the response.',
'Repository reading works best with a narrow question. Begin at the exported response prototype, find the `json` method, and identify the local variables it creates. Then follow the call into the method that actually sends bytes. Do not try to understand the entire file. Record which behavior belongs to Express and which eventually delegates to the Node.js HTTP response. The repository is production code, so compatibility branches and historical decisions make it denser than a tutorial.',
'// Guided task\n// 1. Open lib/response.js\n// 2. Find res.json\n// 3. Follow its call to res.send',
'Express `response.js` source', 'https://github.com/expressjs/express/blob/master/lib/response.js', 'Express.js on GitHub', '`res.json` and `res.send`',
'What is the best first reading goal in this file?', '["Understand all 1000 lines","Trace one value from `res.json` into `res.send`","Memorize every response method"]', 'Trace one value from `res.json` into `res.send`',
'A focused value trace creates a navigable path through real code without requiring you to understand unrelated compatibility logic.');

INSERT OR IGNORE INTO lessons (path_id, topic_id, slug, title, summary, deep_explanation, sequence, published)
SELECT p.id, t.id, s.slug, s.title, s.summary, s.deep_explanation, s.sequence, 1
FROM seed_lessons s
JOIN topics t ON t.slug = CASE WHEN s.sequence < 9 THEN 'javascript-async' ELSE 'node-express' END
JOIN learning_paths p ON p.slug = CASE WHEN s.phase = 'theory' THEN 'async-javascript-theory' ELSE 'async-javascript-practice' END;

INSERT OR IGNORE INTO lesson_sections (lesson_id, heading, body, position)
SELECT l.id, 'Start with the example', '```js\n' || s.example || '\n```', 1
FROM seed_lessons s JOIN lessons l ON l.slug = s.slug;

INSERT OR IGNORE INTO lesson_sections (lesson_id, heading, body, position)
SELECT l.id, 'Why it matters', s.summary, 2
FROM seed_lessons s JOIN lessons l ON l.slug = s.slug;

INSERT INTO sources (lesson_id, title, url, publisher, source_type, relevant_section, verified_on, supported_claims)
SELECT l.id, s.source_title, s.source_url, s.publisher,
  CASE WHEN s.source_url LIKE 'https://github.com/%' THEN 'source_code' ELSE 'documentation' END,
  s.relevant_section, '2026-07-15', s.summary
FROM seed_lessons s JOIN lessons l ON l.slug = s.slug
WHERE NOT EXISTS (SELECT 1 FROM sources existing WHERE existing.lesson_id = l.id AND existing.url = s.source_url);

INSERT INTO quiz_questions (lesson_id, prompt, kind, options_json, correct_answer, explanation, position)
SELECT l.id, s.quiz_prompt, 'multiple_choice', s.options_json, s.correct_answer, s.answer_explanation, 1
FROM seed_lessons s JOIN lessons l ON l.slug = s.slug
WHERE NOT EXISTS (SELECT 1 FROM quiz_questions existing WHERE existing.lesson_id = l.id AND existing.position = 1);

INSERT INTO repository_recommendations (
  lesson_id, repository_url, verified_commit, verified_on, relevant_files_json,
  rationale, difficulty, concepts_json, guided_task, caveats
)
SELECT l.id, 'https://github.com/expressjs/express', NULL, '2026-07-15',
  '["lib/response.js","lib/application.js"]',
  'These files expose real response and application control flow without requiring a full repository tour.',
  'intermediate', '["Express responses","method delegation","middleware application"]',
  'Find `res.json` in `lib/response.js`, follow its value into `res.send`, then locate how the application creates its router in `lib/application.js`.',
  'Production compatibility code makes these files denser than tutorial code. Read only the named paths first.'
FROM lessons l WHERE l.slug = 'navigate-express-source'
  AND NOT EXISTS (SELECT 1 FROM repository_recommendations existing WHERE existing.lesson_id = l.id);

DROP TABLE seed_lessons;
