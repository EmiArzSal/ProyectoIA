// Topic bank for the interview plan.
//
// The bank stores TOPICS, not questions: each technical topic has fixed
// "expected concepts" (the evaluation reference) and one seed question per
// difficulty level. At the start of each interview gpt-4o-mini writes fresh
// questions for the selected topics; the seeds are the fallback when
// generation fails. Everything is aimed at entry-level (junior / intern)
// candidates: no live coding, no algorithms, no system design.
//
// Titles are in Spanish (shown in the UI); concepts and questions are in
// English (the interview language).

export type TopicLevel = 1 | 2 | 3;

export type TechTopic = {
  id: string;
  agentId: string;
  title: string;
  /** Reference for the evaluator. Short, verbal, no code. */
  concepts: string[];
  /** Fallback question for levels 1, 2 and 3. */
  seeds: [string, string, string];
};

export type SoftTopic = {
  id: string;
  title: string;
  /** STAR-oriented criteria for the evaluator. */
  criteria: string[];
  seed: string;
};

export const LEVEL_GUIDE: Record<TopicLevel, string> = {
  1: "Concept: ask the candidate to define or explain the basic idea.",
  2: "Compare: ask for the difference between two related ideas, or when to use each one.",
  3: "Apply: describe a simple, realistic work situation and ask how they would handle it or what might be wrong. It must be answerable verbally, without writing code.",
};

const FE = "ag_frontend_dev_01";
const BE = "ag_backend_dev_01";
const DA = "ag_data_analyst_01";
const QA = "ag_qa_engineer_01";
const DO = "ag_devops_eng_01";

export const TECH_TOPICS: TechTopic[] = [
  // ── Frontend Developer ─────────────────────────────────────────────────────
  {
    id: "fe.semantic_html", agentId: FE, title: "HTML semántico",
    concepts: [
      "Semantic tags describe the meaning of the content (header, nav, main, article, footer)",
      "Helps screen readers and accessibility",
      "Improves SEO and code readability",
      "Avoid using div for everything",
    ],
    seeds: [
      "What is semantic HTML?",
      "What is the difference between a div and a semantic element like article or nav?",
      "You join a project where the whole page is built only with divs. What would you change and why?",
    ],
  },
  {
    id: "fe.accessibility", agentId: FE, title: "Accesibilidad básica",
    concepts: [
      "Alternative text for images",
      "Labels associated with form inputs",
      "Keyboard navigation and a visible focus",
      "Enough color contrast",
      "Use ARIA only when native HTML is not enough",
    ],
    seeds: [
      "What does web accessibility mean?",
      "Why is a label better than a placeholder for a form field?",
      "A user tells you they cannot use your form with the keyboard. What would you check?",
    ],
  },
  {
    id: "fe.box_model", agentId: FE, title: "Modelo de caja y especificidad en CSS",
    concepts: [
      "Content, padding, border and margin",
      "box-sizing border-box includes padding and border in the width",
      "Specificity order: inline styles, ids, classes, elements",
      "With equal specificity, the rule that comes later wins",
    ],
    seeds: [
      "Can you explain the CSS box model?",
      "What is the difference between margin and padding?",
      "Your CSS rule is not being applied to a button. How would you find out why?",
    ],
  },
  {
    id: "fe.flex_grid", agentId: FE, title: "Flexbox y Grid",
    concepts: [
      "Flexbox is one-dimensional: a row or a column",
      "Grid is two-dimensional: rows and columns",
      "justify-content aligns on the main axis and align-items on the cross axis",
      "Choose by layout: components versus full page layouts",
    ],
    seeds: [
      "What is Flexbox used for?",
      "When would you use CSS Grid instead of Flexbox?",
      "You need to center a card horizontally and vertically on the page. How would you do it?",
    ],
  },
  {
    id: "fe.responsive", agentId: FE, title: "Diseño responsive",
    concepts: [
      "Layouts adapt to different screen sizes",
      "Media queries and breakpoints",
      "Mobile-first approach",
      "Relative units and flexible images",
      "The viewport meta tag",
    ],
    seeds: [
      "What is responsive design?",
      "What is the difference between a mobile-first and a desktop-first approach?",
      "A page looks fine on a laptop but breaks on a phone. What would you check first?",
    ],
  },
  {
    id: "fe.js_basics", agentId: FE, title: "Fundamentos de JavaScript",
    concepts: [
      "let and const are block-scoped, var is function-scoped",
      "const prevents reassignment, not changes inside objects",
      "Primitive values versus objects",
      "== converts types before comparing, === compares type and value",
    ],
    seeds: [
      "What is the difference between let and const?",
      "What is the difference between double equals and triple equals in JavaScript?",
      "A teammate compares a number with a string using double equals and gets a surprising result. What would you explain to them?",
    ],
  },
  {
    id: "fe.arrays_objects", agentId: FE, title: "Arrays y objetos",
    concepts: [
      "map transforms each element into a new array",
      "filter keeps the elements that pass a condition",
      "map and filter do not change the original array",
      "Destructuring extracts values from arrays and objects",
    ],
    seeds: [
      "What does the map method do in JavaScript?",
      "What is the difference between map and forEach?",
      "You have a list of products and need only the ones in stock. How would you get them?",
    ],
  },
  {
    id: "fe.async", agentId: FE, title: "Asincronía (promesas y async/await)",
    concepts: [
      "JavaScript runs one task at a time and uses an event loop",
      "A promise represents a value that will be available in the future",
      "async/await is a cleaner way to work with promises",
      "Handle errors with try/catch or catch",
      "fetch returns a promise",
    ],
    seeds: [
      "What is a promise in JavaScript?",
      "What is the difference between using then and using async/await?",
      "Your page renders before an API request finishes, so the list appears empty. Why could that happen?",
    ],
  },
  {
    id: "fe.dom_events", agentId: FE, title: "DOM y eventos",
    concepts: [
      "The DOM is the tree representation of the page",
      "JavaScript can select and update elements",
      "Event listeners respond to user actions",
      "preventDefault stops the default browser behavior",
    ],
    seeds: [
      "What is the DOM?",
      "What does preventDefault do, and when would you use it?",
      "A form reloads the page when you submit it, but you want to handle it with JavaScript. What would you do?",
    ],
  },
  {
    id: "fe.react", agentId: FE, title: "React: componentes, props, state y hooks",
    concepts: [
      "Components are reusable pieces of UI",
      "Props come from the parent and are read-only",
      "State is data owned by the component; changing it re-renders",
      "useState stores state and useEffect runs side effects",
      "The dependency array controls when useEffect runs",
    ],
    seeds: [
      "What is a component in React?",
      "What is the difference between props and state?",
      "A component keeps re-rendering in a loop after you added a useEffect. What could be the cause?",
    ],
  },

  // ── Backend Developer ──────────────────────────────────────────────────────
  {
    id: "be.http", agentId: BE, title: "HTTP: métodos y códigos de estado",
    concepts: [
      "GET reads, POST creates, PUT or PATCH update, DELETE removes",
      "2xx success, 4xx client error, 5xx server error",
      "Common codes: 200, 201, 400, 401, 404, 500",
      "GET requests should not change data",
    ],
    seeds: [
      "What are HTTP methods?",
      "What is the difference between a 401 and a 404 status code?",
      "Your API returns a 500 error when a user sends an empty form. Which status code would be better and why?",
    ],
  },
  {
    id: "be.rest", agentId: BE, title: "Diseño de APIs REST",
    concepts: [
      "Resources are identified by URLs that use nouns",
      "HTTP methods express the action",
      "Requests are stateless",
      "Consistent JSON responses and status codes",
    ],
    seeds: [
      "What is a REST API?",
      "What is the difference between PUT and PATCH?",
      "How would you design the endpoints for a simple to-do list application?",
    ],
  },
  {
    id: "be.sql_basics", agentId: BE, title: "SQL básico",
    concepts: [
      "SELECT reads rows and WHERE filters them",
      "INSERT adds, UPDATE modifies and DELETE removes rows",
      "UPDATE or DELETE without WHERE affects every row",
      "A primary key uniquely identifies a row",
    ],
    seeds: [
      "What is a primary key?",
      "What could happen if you run an UPDATE without a WHERE clause?",
      "You need to find all users who registered this month. How would you build that query, in words?",
    ],
  },
  {
    id: "be.joins", agentId: BE, title: "Relaciones y JOINs",
    concepts: [
      "Foreign keys link tables",
      "One-to-many and many-to-many relationships",
      "INNER JOIN returns only matching rows",
      "LEFT JOIN keeps all rows from the left table",
    ],
    seeds: [
      "What is a foreign key?",
      "What is the difference between an INNER JOIN and a LEFT JOIN?",
      "You need a list of all customers and their orders, including customers with no orders. Which JOIN would you use and why?",
    ],
  },
  {
    id: "be.sql_nosql", agentId: BE, title: "SQL vs NoSQL",
    concepts: [
      "SQL databases use tables with a fixed schema and relations",
      "NoSQL databases store documents, key-value pairs or graphs with a flexible schema",
      "SQL is strong for consistency and complex queries",
      "NoSQL fits data that changes shape and can scale horizontally",
    ],
    seeds: [
      "What is a NoSQL database?",
      "What are the main differences between SQL and NoSQL databases?",
      "You are building an online store with orders and payments. Which type of database would you choose and why?",
    ],
  },
  {
    id: "be.auth", agentId: BE, title: "Autenticación vs autorización",
    concepts: [
      "Authentication verifies who the user is",
      "Authorization decides what the user is allowed to do",
      "Sessions keep state on the server; a JWT carries signed information",
      "Tokens should expire and travel over HTTPS",
    ],
    seeds: [
      "What is authentication?",
      "What is the difference between authentication and authorization?",
      "A regular user can open the admin page of your app. What went wrong and how would you fix it?",
    ],
  },
  {
    id: "be.validation_errors", agentId: BE, title: "Validación de datos y manejo de errores",
    concepts: [
      "Never trust client input; validate on the server",
      "Return clear error messages with the correct status code",
      "Do not show internal errors or stack traces to users",
      "Log errors to debug them later",
    ],
    seeds: [
      "Why is input validation important?",
      "What is the difference between validating data on the frontend and on the backend?",
      "Your API crashes when a user sends text instead of a number. How would you handle it?",
    ],
  },
  {
    id: "be.middleware", agentId: BE, title: "Middleware y ciclo petición/respuesta",
    concepts: [
      "A request goes through routing, middleware and a handler before the response",
      "Middleware runs code before or after the handler",
      "Common uses: authentication, logging, parsing JSON, CORS",
      "Middleware can stop the request or pass it on",
    ],
    seeds: [
      "What is middleware?",
      "What is the difference between middleware and a route handler?",
      "You need to check that the user is logged in on every private endpoint. How would you avoid repeating that code?",
    ],
  },
  {
    id: "be.security", agentId: BE, title: "Seguridad básica",
    concepts: [
      "Hash passwords with a slow algorithm like bcrypt; never store plain text",
      "SQL injection happens when user input is concatenated into a query",
      "Use parameterized queries or an ORM",
      "Use HTTPS and keep secrets out of the code",
    ],
    seeds: [
      "Why should passwords be hashed?",
      "What is the difference between hashing and encrypting?",
      "A login form builds the SQL query by joining the username into the text. What is the risk and how would you fix it?",
    ],
  },
  {
    id: "be.env_config", agentId: BE, title: "Variables de entorno y configuración",
    concepts: [
      "Configuration changes between development, staging and production",
      "Secrets like API keys go in environment variables, not in the code",
      "Environment files should not be committed to Git",
      "The same code runs with different values per environment",
    ],
    seeds: [
      "What is an environment variable?",
      "What is the difference between a development and a production environment?",
      "You accidentally pushed an API key to a public repository. What would you do?",
    ],
  },

  // ── Data Analyst ───────────────────────────────────────────────────────────
  {
    id: "da.sql_select", agentId: DA, title: "Consultas SQL básicas",
    concepts: [
      "SELECT chooses columns and FROM chooses the table",
      "WHERE filters rows",
      "ORDER BY sorts the results",
      "LIMIT restricts the number of rows",
    ],
    seeds: [
      "What does a SELECT statement do?",
      "What is the difference between WHERE and ORDER BY?",
      "Your manager asks for the ten most expensive products. How would you get them with SQL, in words?",
    ],
  },
  {
    id: "da.group_by", agentId: DA, title: "GROUP BY y agregaciones",
    concepts: [
      "GROUP BY groups rows that share a value",
      "Aggregate functions: COUNT, SUM, AVG, MIN, MAX",
      "WHERE filters rows and HAVING filters groups",
      "Each selected column must be grouped or aggregated",
    ],
    seeds: [
      "What does GROUP BY do?",
      "What is the difference between WHERE and HAVING?",
      "You need the total sales for each month. How would you build that query, in words?",
    ],
  },
  {
    id: "da.joins", agentId: DA, title: "JOINs",
    concepts: [
      "A JOIN combines rows from tables using a related column",
      "INNER JOIN returns only matching rows",
      "LEFT JOIN keeps all rows from the left table",
      "Duplicate keys can multiply rows",
    ],
    seeds: [
      "What is a JOIN in SQL?",
      "What is the difference between an INNER JOIN and a LEFT JOIN?",
      "After joining two tables, your total sales doubled. What could have happened?",
    ],
  },
  {
    id: "da.cleaning", agentId: DA, title: "Limpieza de datos",
    concepts: [
      "Find and handle missing values: remove, fill or flag them",
      "Remove duplicate records",
      "Standardize formats like dates, text and units",
      "Document the cleaning decisions",
    ],
    seeds: [
      "What is data cleaning?",
      "What is the difference between removing missing values and filling them in?",
      "You receive a customer file with duplicate rows and dates in different formats. What steps would you take?",
    ],
  },
  {
    id: "da.central_tendency", agentId: DA, title: "Media, mediana y moda",
    concepts: [
      "The mean is the average",
      "The median is the middle value",
      "The mode is the most frequent value",
      "Outliers affect the mean more than the median",
    ],
    seeds: [
      "What is the median?",
      "When is the median a better measure than the mean?",
      "Most employees earn similar salaries but the CEO earns much more. Which measure would you report as the typical salary and why?",
    ],
  },
  {
    id: "da.dispersion", agentId: DA, title: "Dispersión y outliers",
    concepts: [
      "Range and standard deviation measure how spread out the data is",
      "A high standard deviation means values are far from the mean",
      "Outliers are values far from the rest",
      "Investigate outliers before removing them; they can be errors or real cases",
    ],
    seeds: [
      "What is standard deviation?",
      "What is the difference between an outlier caused by an error and a real outlier?",
      "You find one order of one million dollars in a dataset of small purchases. What would you do?",
    ],
  },
  {
    id: "da.correlation", agentId: DA, title: "Correlación vs causalidad",
    concepts: [
      "Correlation measures how two variables move together",
      "Correlation does not prove causation",
      "A third variable can explain the relationship",
      "Experiments like A/B tests can show causation",
    ],
    seeds: [
      "What is correlation?",
      "What is the difference between correlation and causation?",
      "Ice cream sales and sunburns go up at the same time. What would you tell someone who says ice cream causes sunburns?",
    ],
  },
  {
    id: "da.charts", agentId: DA, title: "Elegir el tipo de gráfica",
    concepts: [
      "Line charts show trends over time",
      "Bar charts compare categories",
      "Pie charts only for a few parts of a whole",
      "Keep charts simple and clearly labeled",
    ],
    seeds: [
      "What type of chart would you use to show a trend over time?",
      "When would you use a bar chart instead of a pie chart?",
      "You need to show the monthly sales of five stores to a manager. Which chart would you choose and why?",
    ],
  },
  {
    id: "da.spreadsheets", agentId: DA, title: "Hojas de cálculo",
    concepts: [
      "Pivot tables summarize data by categories",
      "Lookup functions like VLOOKUP or XLOOKUP find values in another table",
      "Filters and sorting",
      "Cell references and simple formulas",
    ],
    seeds: [
      "What is a pivot table?",
      "What is the difference between filtering data and using a pivot table?",
      "You have one sheet with order IDs and another with customer names. How would you combine them?",
    ],
  },
  {
    id: "da.communication", agentId: DA, title: "Comunicar hallazgos y KPIs",
    concepts: [
      "A KPI is a measurable value that tracks a goal",
      "Start with the main insight, then show the evidence",
      "Adapt the language to a non-technical audience",
      "Recommend a next action",
    ],
    seeds: [
      "What is a KPI?",
      "What is the difference between a metric and a KPI?",
      "You found that sales dropped twenty percent last month. How would you present this to your manager?",
    ],
  },

  // ── QA Engineer ────────────────────────────────────────────────────────────
  {
    id: "qa.purpose", agentId: QA, title: "Para qué sirve QA",
    concepts: [
      "QA prevents defects by improving the process",
      "Testing finds defects in the product",
      "Finding bugs early is cheaper",
      "QA represents the user's point of view",
    ],
    seeds: [
      "What is quality assurance?",
      "What is the difference between quality assurance and testing?",
      "A developer says testing is not needed because the code works on their computer. How would you respond?",
    ],
  },
  {
    id: "qa.test_levels", agentId: QA, title: "Tipos de prueba",
    concepts: [
      "Unit tests check a small piece of code in isolation",
      "Integration tests check that parts work together",
      "End-to-end tests check a full user flow",
      "Testing pyramid: many unit tests, fewer end-to-end tests",
    ],
    seeds: [
      "What is a unit test?",
      "What is the difference between an integration test and an end-to-end test?",
      "For a login feature, what would you test with unit tests and what with end-to-end tests?",
    ],
  },
  {
    id: "qa.functional", agentId: QA, title: "Pruebas funcionales vs no funcionales",
    concepts: [
      "Functional tests check what the system does",
      "Non-functional tests check how well it does it",
      "Non-functional examples: performance, security, usability, accessibility",
      "Both come from the requirements",
    ],
    seeds: [
      "What is functional testing?",
      "What is the difference between functional and non-functional testing?",
      "An app works correctly but takes ten seconds to load. What kind of issue is this and how would you report it?",
    ],
  },
  {
    id: "qa.test_cases", agentId: QA, title: "Escribir casos de prueba",
    concepts: [
      "A test case has an ID, preconditions, steps, test data and an expected result",
      "Cover positive and negative scenarios",
      "Steps must be clear and repeatable",
      "Test cases trace back to requirements",
    ],
    seeds: [
      "What is a test case?",
      "What is the difference between a test case and a test scenario?",
      "How would you write test cases for a sign-up form?",
    ],
  },
  {
    id: "qa.equivalence_boundary", agentId: QA, title: "Particiones de equivalencia y valores límite",
    concepts: [
      "Equivalence partitioning groups inputs that behave the same way",
      "Test one value from each group",
      "Boundary value analysis tests the edges of a range",
      "Bugs often appear at the boundaries",
    ],
    seeds: [
      "What is boundary value analysis?",
      "What is the difference between equivalence partitioning and boundary value analysis?",
      "A field accepts ages from eighteen to sixty. Which values would you test and why?",
    ],
  },
  {
    id: "qa.bug_report", agentId: QA, title: "Reportar un bug",
    concepts: [
      "A clear title and steps to reproduce",
      "Expected result versus actual result",
      "Environment details, screenshots or logs",
      "Severity is the impact; priority is how urgent the fix is",
    ],
    seeds: [
      "What should a good bug report include?",
      "What is the difference between severity and priority?",
      "You find that the checkout button does nothing on mobile. How would you report it?",
    ],
  },
  {
    id: "qa.bug_lifecycle", agentId: QA, title: "Ciclo de vida de un bug",
    concepts: [
      "States: new, assigned, in progress, fixed, retest, closed",
      "A bug is reopened if it fails the retest",
      "Some bugs are rejected or postponed",
      "Clear communication with developers",
    ],
    seeds: [
      "What is the bug life cycle?",
      "What is the difference between closing a bug and rejecting it?",
      "A developer marks your bug as cannot reproduce. What would you do?",
    ],
  },
  {
    id: "qa.regression_smoke", agentId: QA, title: "Regresión y smoke testing",
    concepts: [
      "Smoke testing checks that the main features work in a new build",
      "Regression testing checks that changes did not break existing features",
      "Regression tests are good candidates for automation",
      "Smoke testing is fast and shallow; regression is broader",
    ],
    seeds: [
      "What is regression testing?",
      "What is the difference between smoke testing and regression testing?",
      "The team fixed a bug in the payment module right before a release. What testing would you do?",
    ],
  },
  {
    id: "qa.manual_auto", agentId: QA, title: "Pruebas manuales vs automatizadas",
    concepts: [
      "Manual testing fits exploratory and usability testing",
      "Automation fits repetitive and stable tests like regression",
      "Tools like Selenium or Cypress control the browser",
      "Automated tests need maintenance",
    ],
    seeds: [
      "What is automated testing?",
      "When is manual testing better than automated testing?",
      "Your team runs the same fifty tests by hand every week. What would you suggest?",
    ],
  },
  {
    id: "qa.api_testing", agentId: QA, title: "Probar APIs",
    concepts: [
      "Send requests and check the status code, response body and response time",
      "Test valid and invalid inputs",
      "Tools like Postman",
      "APIs can be tested before the user interface is ready",
    ],
    seeds: [
      "What is API testing?",
      "What is the difference between testing an API and testing the user interface?",
      "An endpoint that creates users returns 200 even when the email is missing. Is this a bug, and how would you report it?",
    ],
  },

  // ── DevOps Engineer ────────────────────────────────────────────────────────
  {
    id: "do.linux_cmds", agentId: DO, title: "Comandos básicos de Linux",
    concepts: [
      "Navigate with cd, ls and pwd",
      "Manage files with cp, mv, rm and mkdir",
      "Read files with cat, less or head",
      "Search with grep and find",
    ],
    seeds: [
      "Which Linux commands do you use most often, and what do they do?",
      "What is the difference between the cp and mv commands?",
      "You need to find which file in a folder contains the word error. How would you do it?",
    ],
  },
  {
    id: "do.permissions", agentId: DO, title: "Permisos y usuarios",
    concepts: [
      "Read, write and execute permissions",
      "Owner, group and others",
      "chmod changes permissions and chown changes the owner",
      "sudo runs commands with elevated privileges; use the least privilege needed",
    ],
    seeds: [
      "What are file permissions in Linux?",
      "What is the difference between chmod and chown?",
      "A script fails with a permission denied error. What would you check?",
    ],
  },
  {
    id: "do.processes_logs", agentId: DO, title: "Procesos y logs",
    concepts: [
      "ps and top show running processes and resource usage",
      "kill stops a process",
      "Logs usually live in /var/log or are read with journalctl",
      "tail with the follow option shows a log in real time",
    ],
    seeds: [
      "What is a process in an operating system?",
      "What is the difference between the ps and top commands?",
      "A server is very slow. How would you find out what is using the CPU?",
    ],
  },
  {
    id: "do.networking", agentId: DO, title: "Redes básicas",
    concepts: [
      "An IP address identifies a machine on a network",
      "A port identifies a service, like 80 for HTTP and 443 for HTTPS",
      "DNS translates domain names into IP addresses",
      "Firewalls control which ports are open",
    ],
    seeds: [
      "What is DNS?",
      "What is the difference between an IP address and a port?",
      "Users can open your site using its IP address but not its domain name. What could be wrong?",
    ],
  },
  {
    id: "do.git", agentId: DO, title: "Git: ramas, merge y conflictos",
    concepts: [
      "Branches let you work without affecting the main branch",
      "Merge combines the changes of two branches",
      "A conflict happens when the same lines changed in both branches",
      "Pull requests allow code review before merging",
    ],
    seeds: [
      "What is a branch in Git?",
      "What is the difference between git fetch and git pull?",
      "You get a merge conflict when merging your branch. What would you do?",
    ],
  },
  {
    id: "do.cicd", agentId: DO, title: "Qué es CI/CD",
    concepts: [
      "Continuous integration: merge often and run automatic builds and tests",
      "Continuous delivery: the code is always ready to deploy",
      "Continuous deployment: changes reach production automatically",
      "Finds problems early and reduces manual work",
    ],
    seeds: [
      "What is continuous integration?",
      "What is the difference between continuous delivery and continuous deployment?",
      "Your team deploys by hand once a month and often breaks something. How could CI/CD help?",
    ],
  },
  {
    id: "do.pipeline", agentId: DO, title: "Etapas de un pipeline",
    concepts: [
      "Typical stages: build, test, deploy",
      "If a stage fails, the pipeline stops",
      "Tools like GitHub Actions, GitLab CI or Jenkins",
      "Environments like staging and production",
    ],
    seeds: [
      "What is a CI/CD pipeline?",
      "Why does the test stage come before the deploy stage?",
      "The pipeline fails at the test stage right after your commit. What would you do?",
    ],
  },
  {
    id: "do.docker_basics", agentId: DO, title: "Docker: imagen vs contenedor",
    concepts: [
      "An image is a read-only template",
      "A container is a running instance of an image",
      "Containers share the host kernel and are lighter than virtual machines",
      "The same environment everywhere",
    ],
    seeds: [
      "What is Docker?",
      "What is the difference between a Docker image and a container?",
      "A teammate says the app works on their machine but not on yours. How could Docker help?",
    ],
  },
  {
    id: "do.dockerfile_compose", agentId: DO, title: "Dockerfile y docker-compose",
    concepts: [
      "A Dockerfile describes how to build an image",
      "Main instructions: FROM, COPY, RUN and CMD",
      "docker-compose defines and runs several containers together",
      "Useful for running an app together with its database",
    ],
    seeds: [
      "What is a Dockerfile?",
      "What is the difference between a Dockerfile and a docker-compose file?",
      "Your web app needs a database to run locally. How would you set this up with Docker?",
    ],
  },
  {
    id: "do.cloud_monitoring", agentId: DO, title: "Nube y monitoreo básico",
    concepts: [
      "IaaS gives virtual machines, PaaS gives a platform, SaaS gives a finished product",
      "Common services: compute, storage and databases",
      "Monitoring uses logs, metrics and alerts",
      "Tools like Prometheus, Grafana or CloudWatch",
    ],
    seeds: [
      "What is cloud computing?",
      "What is the difference between IaaS, PaaS and SaaS?",
      "Your app went down at night and nobody noticed until the morning. What would you set up to avoid this?",
    ],
  },
];

export const SOFT_TOPICS: SoftTopic[] = [
  {
    id: "soft.proud_project", title: "Proyecto del que estés orgulloso",
    criteria: [
      "Describes the project and its goal",
      "Explains their own role and contributions",
      "Mentions a challenge and how it was solved",
      "States the result or what they learned",
    ],
    seed: "Tell me about a school or personal project you are proud of.",
  },
  {
    id: "soft.teamwork", title: "Trabajo en equipo",
    criteria: [
      "Describes the team and the goal",
      "Explains their specific actions",
      "Shows how they communicated and coordinated",
      "States the outcome",
    ],
    seed: "Tell me about a time you worked in a team to reach a goal.",
  },
  {
    id: "soft.conflict", title: "Resolver un desacuerdo o conflicto",
    criteria: [
      "Describes the disagreement objectively",
      "Listened to the other person's point of view",
      "Took actions to reach a solution",
      "States the outcome and what they learned",
    ],
    seed: "Tell me about a time you disagreed with a teammate. How did you handle it?",
  },
  {
    id: "soft.learn_fast", title: "Aprender algo nuevo rápido",
    criteria: [
      "Explains what they had to learn and why",
      "Describes how they learned it",
      "Explains how they applied it",
      "States the result",
    ],
    seed: "Describe a time you had to learn something new very quickly.",
  },
  {
    id: "soft.mistake", title: "Un error y qué aprendiste",
    criteria: [
      "Owns the mistake honestly",
      "Describes the actions taken to fix it",
      "Explains what they learned",
      "Says what they do differently now",
    ],
    seed: "Tell me about a mistake you made and what you learned from it.",
  },
  {
    id: "soft.prioritize", title: "Priorizar con poco tiempo",
    criteria: [
      "Describes the competing tasks and deadlines",
      "Explains how they decided the priorities",
      "Mentions communication with others",
      "States the result",
    ],
    seed: "Tell me about a time you had several deadlines at once. How did you prioritize?",
  },
  {
    id: "soft.feedback", title: "Recibir retroalimentación",
    criteria: [
      "Describes the feedback received",
      "Reacted openly, not defensively",
      "Made concrete changes",
      "States the result of those changes",
    ],
    seed: "Tell me about a time you received feedback on your work. How did you respond?",
  },
  {
    id: "soft.explain_tech", title: "Explicar algo técnico a alguien no técnico",
    criteria: [
      "Adapted the language to the audience",
      "Used examples or analogies",
      "Checked that the person understood",
      "States the result",
    ],
    seed: "Tell me about a time you explained something technical to someone without a technical background.",
  },
];

const TOPIC_TITLES = new Map<string, string>([
  ...TECH_TOPICS.map((t) => [t.id, t.title] as const),
  ...SOFT_TOPICS.map((t) => [t.id, t.title] as const),
]);

export const getTopicTitle = (id: string) => TOPIC_TITLES.get(id) ?? id;
export const getTechTopic = (id: string) => TECH_TOPICS.find((t) => t.id === id);
export const getSoftTopic = (id: string) => SOFT_TOPICS.find((t) => t.id === id);
export const getTechTopicsForAgent = (agentId: string) =>
  TECH_TOPICS.filter((t) => t.agentId === agentId);
