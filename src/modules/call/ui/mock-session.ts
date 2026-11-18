// ── Mock mode (set NEXT_PUBLIC_SESSION_MOCK=true in .env.local) ────────────────
// Zero API calls — use fake responses and short timers for UI development testing.

export const IS_MOCK = process.env.NEXT_PUBLIC_SESSION_MOCK === "true";
export const MOCK_TIMER_S = 5;

export const MOCK_AGENT_RESPONSES = [
  "Hello! I'm Alex, your interviewer today. We'll go through some technical and behavioral questions. Let's start — can you explain what the virtual DOM is and why React uses it?",
  "Good. Next: what's the difference between useState and useReducer in React, and when would you choose one over the other?",
  "Nice. Can you explain what a JavaScript closure is and give a practical example?",
  "Got it. What's the difference between Flexbox and CSS Grid, and when do you use each?",
  "Good answer. Can you explain what async/await is and how it relates to Promises?",
  "Alright. What does the term 'semantic HTML' mean, and why does it matter for accessibility?",
  "Let's switch to behavioral questions. Tell me about a personal or academic project you're proud of.",
  "That's great. Describe a time you had to learn a new technology quickly — how did you approach it?",
  "Good. How do you prioritize tasks when working under a deadline?",
  "Last question: describe a challenging bug you encountered. How did you debug and fix it?",
  "Thank you! That concludes our interview. You demonstrated solid knowledge across frontend fundamentals and gave thoughtful answers to the behavioral questions. Good luck!",
];

export const MOCK_USER_ANSWERS = [
  "Mmm, the virtual DOM is like a copy of the real DOM but in memory. React use it to, how to say, compare changes and then update only the parts that changed. Is more fast than change everything.",
  "I think useState is for when you have simple things to save, like a number or a text. useReducer is for when the logic is more complicated, like when you have many things that change together. I use useState most of times.",
  "A closure is... when a function can remember variables from outside, even when the outside function already finished. For example if you have a function that returns another function, the inside one still can use the variables.",
  "Flexbox is for put things in one line, like a row or a column. Grid is when you need rows and columns at same time, like a table but more flexible. I use flexbox more because is more easy for me.",
  "Async await is like a way to work with promises but more easy to read. Instead of write many dot then, you just put await and the code wait until the promise finish. I think is same thing but different syntax.",
  "Semantic HTML is use the correct tags for each thing. Like, use header for the header and nav for navigation instead of use div for everything. Is good because help the browser understand the page better.",
  "Yes, I make a web app for manage tasks in my university. We use React in the front and a simple API in the back. I was in charge of the interface and I learned a lot about how to organize the components.",
  "In my last semester I need to learn a framework very fast for a project. I watched some videos and read the documentation and then I just start coding. I make errors but I learn from them and finish the project.",
  "I try to organize my tasks by which is more important and which need to be done first. If I have too many things I talk with my team to see if someone can help. I also write lists to not forget anything.",
  "One time I have a bug where a component was rendering infinite times. I was confuse for a long time. Then I ask a friend and he tell me the problem was in the dependency array of useEffect. I was passing an object and it change every render.",
];
