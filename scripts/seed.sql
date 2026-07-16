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
'Follow the execution
JavaScript creates one function object when it evaluates the `greet` declaration. The name `greet` refers to that object. In `run(greet)`, JavaScript reads the value under the name and assigns the same function object to the parameter `task`. The body of `run` invokes it only when execution reaches `task()`.

Why functions work as values
JavaScript lets variables, array entries, object properties, and parameters hold functions. Code can therefore choose behavior now and let another part of the program run it later. Callbacks, Express middleware, and Promise handlers all use this ability.

Common mistake
`run(greet())` follows a different order. The parentheses call `greet` first, producing the string `"hello"`. JavaScript then passes that string into `run`, and `task()` fails because a string is not callable. Trace the expression before deciding what value crosses the function boundary.',
'function greet() { return "hello"; }\nfunction run(task) { return task(); }\nrun(greet);',
'Functions', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions', 'MDN Web Docs', 'Function expressions and calling functions',
'What does `run(greet)` pass into `run`?', '["The string returned by greet","The greet function object","The source-code text of greet"]', 'The greet function object',
'Without parentheses, `greet` evaluates to the function object. `greet()` would call it first and pass the returned string.'),

(2, 'theory', 'parameters-hold-values', 'A parameter receives the passed value',
'In `run(greet)`, `task` is not a special callback variable. It is an ordinary parameter whose value happens to be a function object. Renaming it to `banana` changes no behavior.',
'Follow the execution
JavaScript evaluates the argument expression `sayHi` first. That name comes from `const sayHi = ...`, and its value is a function object. JavaScript creates the local parameter `task` for this call and stores a reference to the same object in it. Inside `run`, `task()` calls the function and returns `"hi"`.

Why the names can differ
An argument is the expression at the call site. A parameter is the local name in the called function. JavaScript connects them by position, so `run(sayHi)` gives the first argument value to the first parameter. Renaming `task` to `banana` changes the local label, not the value.

Common mistake
`run(sayHi())` calls `sayHi` before `run` starts, then passes the returned string. Calling that string as `task()` throws a `TypeError`. Trace four things in order: the argument expression, its resulting value, the parameter receiving it, and the operation performed on that parameter.',
'function run(task) { return task(); }\nconst sayHi = () => "hi";\nrun(sayHi);',
'Functions', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions', 'MDN Web Docs', 'Function parameters',
'Inside `run`, what value does `task` hold?', '["The name sayHi","The same function object referenced by sayHi","The result hi"]', 'The same function object referenced by sayHi',
'Arguments are evaluated and their values are assigned to parameters. Here that value is the function object.'),

(3, 'theory', 'callbacks-defer-control', 'A callback gives another function control over timing',
'Passing `onDone` into `loadData` does not promise that it runs immediately. `loadData` owns the call site, so it decides whether to invoke the callback now, later, once, many times, or never.',
'Follow the execution
The arrow function creates a function object. `setTimeout` receives that object and the number `1000`, registers a timer, and returns. JavaScript continues to `console.log("now")`. After at least one second, the runtime may place the callback into later work, but it still waits for the current JavaScript job to finish.

Who owns the call
The receiving API decides when and how often it invokes a callback. Array `map` calls its callback once per item. An event listener may call it many times. A canceled timer may never call it. You need the API contract to know which behavior applies.

Common mistake
Passing a callback does not run it. Writing `setTimeout(showMessage(), 1000)` runs `showMessage` during argument evaluation and passes its return value. Locate both sites when reading callback code: where the function enters the API and where the API invokes it.',
'setTimeout(() => console.log("later"), 1000);\nconsole.log("now");',
'Callback function', 'https://developer.mozilla.org/en-US/docs/Glossary/Callback_function', 'MDN Web Docs', 'Callback function definition',
'Who decides when the callback passed to `setTimeout` is called?', '["The callback itself","The `setTimeout` API and runtime","The variable name"]', 'The `setTimeout` API and runtime',
'The receiving API owns the invocation. The callback only describes what should happen when invoked.'),

(4, 'theory', 'run-to-completion', 'JavaScript finishes the current job first',
'A timer becoming ready does not interrupt a function halfway through. The current JavaScript job runs to completion; only then can the event loop select another queued job.',
'Follow the execution
The script schedules the timer and then enters the `for` loop. Each active function call occupies the call stack. The timer may become ready while the loop runs, but its callback cannot enter that stack. JavaScript prints `"loop done"` before the current script job ends.

Why this rule exists
Run-to-completion lets you reason about adjacent synchronous statements without an unrelated callback changing local state between them. The event loop chooses queued work after the active job returns and the stack becomes empty.

Common mistake
A delay of zero means the timer becomes eligible after the minimum delay. It does not mean immediate execution. Long synchronous work still postpones timers, clicks, and rendering because those callbacks need a later turn.',
'setTimeout(() => console.log("timer"), 0);\nfor (let i = 0; i < 1000000; i++) {}\nconsole.log("loop done");',
'JavaScript execution model', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model', 'MDN Web Docs', 'Run-to-completion',
'Can the timer callback interrupt the `for` loop?', '["Yes, after zero milliseconds","No, the current job must finish","Only in Node.js"]', 'No, the current job must finish',
'A ready callback waits until the active JavaScript job completes and the call stack becomes available.'),

(5, 'theory', 'tasks-and-microtasks', 'Promise handlers use the microtask queue',
'After synchronous code finishes, Promise reactions run before the event loop takes the next ordinary task such as a timer callback. That is why a resolved Promise often logs before `setTimeout(..., 0)`.',
'Follow the execution
The script registers a timer task, registers a Promise reaction, and prints `"sync"`. After the script job ends, the runtime performs a microtask checkpoint. It runs the Promise handler and prints `"microtask"`, then selects the timer task and prints `"task"`.

Why two queues matter
Promise reactions use microtasks so chained computations can continue before the browser takes another event-loop task. Timers, input events, and other host work use tasks. The host drains the microtask queue at defined checkpoints before choosing the next task.

Common mistake
Microtasks do not interrupt synchronous code. A microtask can also queue another microtask, so an endless chain can delay timers and browser rendering. Use the ordering rule for this example, while remembering that the HTML standard defines more checkpoints than the short slogan shows.',
'setTimeout(() => console.log("task"), 0);\nPromise.resolve().then(() => console.log("microtask"));\nconsole.log("sync");',
'HTML Standard: Event loops', 'https://html.spec.whatwg.org/multipage/webappapis.html#event-loops', 'WHATWG', 'Event loops and microtask queue',
'Which usually logs first after `sync`?', '["task","microtask","They are random"]', 'microtask',
'Promise reactions are microtasks, and the runtime drains microtasks before selecting the next timer task.'),

(6, 'theory', 'promises-represent-outcomes', 'A Promise represents a future outcome',
'A Promise is an object you receive immediately, even when the underlying result is not ready. It moves from pending to fulfilled or rejected, and registered handlers react to that settled outcome.',
'Follow the execution
`fetch("/api/item")` starts a network request and returns a Promise object before a response arrives. `resultPromise` stores that Promise. Calling `.then(...)` registers a function to receive the fulfilled value and returns a new Promise for whatever that handler produces.

What the Promise stores
A Promise begins pending and settles once as fulfilled with a value or rejected with a reason. It keeps that outcome. Adding a handler after settlement still schedules the matching reaction, so callers do not need to race the operation.

Common mistake
The Promise is not the response or JSON data. Logging `resultPromise` inspects the wrapper, while `await resultPromise` resumes with its fulfilled value or throws its rejection. A `.then` chain creates new Promises, which is how returned values and failures move through the chain.',
'const resultPromise = fetch("/api/item");\nresultPromise.then(response => response.json());',
'Promise', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise', 'MDN Web Docs', 'Description and Promise states',
'What value does `fetch` return immediately?', '["The final JSON object","A Promise","Nothing until the network finishes"]', 'A Promise',
'The Promise is available immediately and later settles according to the network operation.'),

(7, 'theory', 'async-await-suspends-function', '`await` suspends one async function',
'When an async function reaches `await`, that function pauses and returns control to its caller. The JavaScript thread is not blocked; other work can run before the function continuation resumes.',
'Follow the execution
Calling `load()` starts the function and returns a Promise to the caller. Inside `load`, `fetch` returns another Promise. At `await`, JavaScript saves the remaining work in `load` and gives control back to the caller. The variable `pending` therefore holds the Promise returned by `load`.

How the function resumes
After the fetch Promise settles, JavaScript queues the saved continuation as a microtask. A fulfilled Promise gives its value to `response`; a rejected Promise makes `await` throw inside `load`. The later `return response.json()` determines how the Promise from `load` settles.

Common mistake
`await` pauses one async function, not the JavaScript thread or Node process. Other timers, requests, and callbacks can run while `load` waits. Two independent awaits written one after another can still create unnecessary sequential waiting.',
'async function load() {\n  const response = await fetch("/api/item");\n  return response.json();\n}\nconst pending = load();',
'async function', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function', 'MDN Web Docs', 'Description',
'What does calling `load()` return before `fetch` finishes?', '["A Promise","The response object","It blocks and returns nothing"]', 'A Promise',
'Every async function call returns a Promise. `await` suspends that function rather than blocking the JavaScript thread.'),

(8, 'practice', 'predict-event-loop-output', 'Predict Node.js event-loop output',
'Trace the synchronous log first, then Promise microtasks, then timer work. The exercise is not about memorizing a slogan; it is about naming which queue receives each continuation.',
'Trace each line
The active script calls `setTimeout`, which registers the callback that prints `B`. `Promise.resolve().then(...)` registers a Promise reaction that prints `C`. The final line runs now and prints `A`. No queued callback can run until this script job finishes.

Build the output
Node processes the Promise reaction after the script, so `C` comes next. The timer callback runs afterward and prints `B`. The output is `A, C, B`. Writing the queue beside each line is safer than guessing from visual order.

Where the model stops
Node has several event-loop phases plus special handling such as `process.nextTick`. This example only needs current script, Promise microtask, and timer. Add the fuller phase model when code uses I/O callbacks, immediates, or next-tick callbacks.',
'setTimeout(() => console.log("B"), 0);\nPromise.resolve().then(() => console.log("C"));\nconsole.log("A");',
'The Node.js Event Loop', 'https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick', 'Node.js', 'Event loop phases',
'What is the output order?', '["A, B, C","A, C, B","C, A, B"]', 'A, C, B',
'The script prints A synchronously. The Promise reaction is a microtask, so C runs before the timer prints B.'),

(9, 'practice', 'read-express-route', 'Read an Express route from request to response',
'In `app.get("/users/:id", handler)`, Express stores a route definition. For a matching GET request it builds `req` and `res`, calls `handler`, and `res.json` writes the HTTP response.',
'Follow the request
`app.get` registers a handler for GET requests whose path matches `/users/:id`. For `/users/42`, Express creates `req` and `res`, stores `"42"` under `req.params.id`, and calls the async handler. `users.find` receives that string and returns a Promise that `await` settles into `user`.

Follow the response
`res.json(user)` serializes the selected JavaScript value as JSON, sets an appropriate content type, and sends the HTTP response. The route has finished its useful work once it sends or delegates the response.

Common mistake
`req.params.id` comes from the URL, not the database, and it starts as untrusted text. Real code must validate it before a query. If `users.find` rejects, the failure must reach Express error handling so the client receives a deliberate response.',
'app.get("/users/:id", async (req, res) => {\n  const user = await users.find(req.params.id);\n  res.json(user);\n});',
'Express routing', 'https://expressjs.com/en/guide/routing/', 'Express.js', 'Route methods and route parameters',
'Where does `req.params.id` come from?', '["The JSON request body","The `:id` segment of the matched URL","The database"]', 'The `:id` segment of the matched URL',
'Express extracts the value from the path segment matched by `:id` and places it in `req.params`.'),

(10, 'practice', 'trace-middleware-next', 'Trace `next()` through middleware',
'Express middleware receives `req`, `res`, and `next`. Calling `next()` transfers control to the next matching layer. Omitting it is valid only when the current middleware finishes the response or handles the error.',
'Follow the call stack
Express calls the middleware with the current `req`, `res`, and a `next` function. It prints `"before"`, then calls `next()`. Express invokes the next matching middleware or route. After downstream code returns, execution continues after the original `next()` call and prints `"after"`.

Why the same objects travel
Middleware layers cooperate on one HTTP exchange. One layer can add authentication data to `req`; another can read it. A route can set response data that later middleware observes, as long as the response has not already ended.

Common mistake
Middleware that neither sends a response nor calls `next()` leaves the request waiting. Calling `next(error)` chooses error-handling middleware instead of the ordinary stack. Avoid sending a response and then calling `next`, because a later layer may try to send a second response.',
'app.use((req, res, next) => {\n  console.log("before");\n  next();\n  console.log("after");\n});',
'Using Express middleware', 'https://expressjs.com/en/guide/using-middleware/', 'Express.js', 'Application-level middleware',
'What must middleware do if it does not send a response?', '["Return the request","Call `next()`","Create a new app"]', 'Call `next()`',
'Calling `next()` lets Express continue to the next matching middleware or route handler.'),

(11, 'practice', 'convert-callback-to-promise', 'Compare callback and Promise file reads',
'Both examples request the same file read. The callback API puts success and failure in callback arguments; the Promise API returns an object that `await` can settle into a value or throw as an exception.',
'Compare the returned values
`fs.readFile(path, callback)` starts the file read and returns `undefined`; Node later calls the callback with `error` and `data`. `fs.promises.readFile(path, "utf8")` starts the same kind of work and returns a Promise. `await` resumes with a string because the encoding asks Node to decode the bytes.

Compare failure handling
The callback form places failure in the first callback argument. The Promise form rejects, so `await` throws and a surrounding `try/catch` can handle it. Both APIs still depend on Node and the operating system to perform the file operation.

Common mistake
`await` does not turn the read into synchronous I/O. It suspends the current async function while other work can continue. Forgetting `"utf8"` also changes the returned value from a string to a `Buffer` of bytes.',
'const text = await fs.promises.readFile("notes.txt", "utf8");\nconsole.log(text);',
'Node.js file system promises API', 'https://nodejs.org/api/fs.html#promises-api', 'Node.js', 'Promises API',
'Does `await readFile` make the file operation synchronous?', '["Yes","No, it suspends only the async function","Only on Windows"]', 'No, it suspends only the async function',
'The I/O remains asynchronous. `await` changes how that async function pauses and resumes.'),

(12, 'practice', 'find-sequential-await', 'Spot accidental sequential awaits',
'Two independent requests awaited one after another take roughly the sum of both waits. Starting both operations first and then using `Promise.all` allows their waiting periods to overlap.',
'Compare the timelines
With `const user = await fetchUser()`, JavaScript does not call `fetchPosts()` until the user request settles. If each request takes one second, the function waits about two seconds. In the `Promise.all` version, JavaScript calls both functions while building the array, so both requests start before the await.

How the result is shaped
`Promise.all` returns one Promise. It fulfills with an array whose positions match the input positions, which lets destructuring assign the first value to `user` and the second to `posts`. It rejects when any input rejects.

Common mistake
Use this only when the operations are independent. If `fetchPosts` needs the user ID returned by `fetchUser`, sequential order expresses a real dependency. Overlapping network waits is concurrency; it does not mean JavaScript executes both continuations on two threads.',
'const [user, posts] = await Promise.all([\n  fetchUser(),\n  fetchPosts(),\n]);',
'await operator', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await', 'MDN Web Docs', 'Improving performance by lowering promise chain dependency',
'When should two operations use `Promise.all`?', '["When the second needs the first result","When they are independent and may overlap","For every Promise"]', 'When they are independent and may overlap',
'Independent operations can start together. Dependent operations must preserve their required order.'),

(13, 'practice', 'diagnose-express-error', 'Route rejected Promises into Express error handling',
'An asynchronous route can fail after returning control to Express. The failure must reach error-handling middleware so the request gets a deliberate response instead of hanging or exposing internal details.',
'Follow the failure
An async route may return a Promise that later rejects. Express 5 forwards that rejection to error-handling middleware. Callback-based code must call `next(error)` because Express cannot observe an error that stays inside another callback.

Recognize the handler
Error middleware has four parameters in this order: `err`, `req`, `res`, and `next`. The handler can log the internal error, choose a status code, and send a stable JSON shape such as `{ error: "Internal error" }`.

Common mistake
Do not send stack traces, SQL messages, or secret-bearing request details to an unauthenticated client. If response headers were already sent, the error handler should delegate with `next(err)` instead of trying to write a second response.',
'app.use((err, req, res, next) => {\n  console.error(err);\n  res.status(500).json({ error: "Internal error" });\n});',
'Express error handling', 'https://expressjs.com/en/guide/error-handling/', 'Express.js', 'Catching errors',
'What distinguishes Express error middleware?', '["It has four parameters","It must use async","It has no response object"]', 'It has four parameters',
'Express recognizes error-handling middleware by the four-parameter signature `err, req, res, next`.'),

(14, 'practice', 'navigate-express-source', 'Follow a real Express response method',
'Read `lib/response.js` in the Express repository and locate `res.json`. Follow the value from the method argument through JSON serialization to the call that sends the response.',
'Start at one symbol
Open `lib/response.js` and search for the definition of `res.json`. Identify the input parameter and the local value created by JSON serialization. Then follow the call to `this.send(body)`. You now have a short path through a large production file.

Separate the layers
Express adds framework behavior such as settings, headers, and serialization. Its response object builds on Node HTTP response behavior, which owns the lower-level connection and bytes. Write down which layer performs each step instead of treating the whole file as one system.

Handle production-code noise
Compatibility branches and helper calls exist because Express supports many applications and years of behavior. You do not need to memorize them. Keep one question in view: how does the value passed to `res.json` reach `res.send`? After that path makes sense, choose one helper and repeat the trace.',
'// Guided task\n// 1. Open lib/response.js\n// 2. Find res.json\n// 3. Follow its call to res.send',
'Express `response.js` source', 'https://github.com/expressjs/express/blob/master/lib/response.js', 'Express.js on GitHub', '`res.json` and `res.send`',
'What is the best first reading goal in this file?', '["Understand all 1000 lines","Trace one value from `res.json` into `res.send`","Memorize every response method"]', 'Trace one value from `res.json` into `res.send`',
'A focused value trace creates a navigable path through real code without requiring you to understand unrelated compatibility logic.');

INSERT OR IGNORE INTO lessons (path_id, topic_id, slug, title, summary, deep_explanation, sequence, published)
SELECT p.id, t.id, s.slug, s.title, s.summary, s.deep_explanation, s.sequence, 1
FROM seed_lessons s
JOIN topics t ON t.slug = CASE WHEN s.sequence < 9 THEN 'javascript-async' ELSE 'node-express' END
JOIN learning_paths p ON p.slug = CASE WHEN s.phase = 'theory' THEN 'async-javascript-theory' ELSE 'async-javascript-practice' END;

UPDATE lessons
SET summary = (SELECT s.summary FROM seed_lessons s WHERE s.slug = lessons.slug),
    deep_explanation = (SELECT s.deep_explanation FROM seed_lessons s WHERE s.slug = lessons.slug)
WHERE slug IN (SELECT slug FROM seed_lessons);

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
