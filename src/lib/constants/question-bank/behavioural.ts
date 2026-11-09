import type { BankQuestion } from "./types";

/**
 * Behavioural answers are judged on structure more than on vocabulary, so the
 * rubric phrases look for the parts of a story (situation, action, result,
 * lesson) rather than for technical terms.
 */
export const BEHAVIOURAL_QUESTIONS: readonly BankQuestion[] = [
  {
    id: "bh-01",
    difficulty: "BEGINNER",
    topic: "Tell me about yourself",
    text: "Tell me about yourself in about a minute.",
    rubric: [
      { label: "Opens with who you are now: your degree, year or current role", anyOf: ["i am a", "i'm a", "currently", "studying", "final year", "third year", "student", "work as"] },
      { label: "Names specific projects, skills or experience that are relevant to the role", anyOf: ["project", "built", "internship", "experience", "skills", "worked on", "developed"], min: 2 },
      { label: "Looks forward: what you want to do next and why this role", anyOf: ["looking for", "i want to", "i am looking", "excited", "next step", "goal", "this role", "this opportunity"] },
      { label: "Stays concise and ties the story together", anyOf: ["that is why", "that's why", "which is why", "so i", "brings me"] },
    ],
    modelAnswer:
      "I am a final-year engineering student, currently focused on web development. Over the last two years I built a full-stack booking app with Next.js and PostgreSQL in a team of three, and I did an internship where I fixed bugs in a React codebase and learned to work with code reviews. That mix of projects and real feedback is what I enjoy most. I am looking for a junior developer role where I can keep building products end to end, which is why this opportunity stood out to me.",
  },
  {
    id: "bh-02",
    difficulty: "BEGINNER",
    topic: "Motivation and fit",
    text: "Why do you want to work as a software engineer, and why at this company?",
    rubric: [
      { label: "Gives a genuine reason for the career, not a generic one", anyOf: ["enjoy", "love", "problem solving", "problem-solving", "building", "curious", "satisf", "passion"] },
      { label: "Shows specific knowledge of the company, its product or its team", anyOf: ["your product", "your team", "your company", "i read", "i used", "i noticed", "your engineering", "your mission"] },
      { label: "Connects your own skills or projects to what the role needs", anyOf: ["my project", "my experience", "my skills", "i have built", "i have worked", "relevant", "fits"] },
      { label: "Mentions what you hope to learn or contribute", anyOf: ["learn", "grow", "contribute", "mentor", "impact", "improve"] },
    ],
    modelAnswer:
      "I enjoy problem solving and the satisfaction of building something people actually use. I used your product during my last project and noticed how fast the interface feels, and I read your engineering blog about moving to server-rendered pages, which is exactly the area I have been working in. My own project with Next.js taught me how much performance shapes the experience, so this role fits my skills. I hope to learn from experienced reviewers and contribute to features from the first month.",
  },
  {
    id: "bh-03",
    difficulty: "BEGINNER",
    topic: "Teamwork and conflict",
    text: "Tell me about a project you worked on in a team. What was your role, and how did the team work together?",
    rubric: [
      { label: "Sets the context: what the project was and how big the team was", anyOf: ["project", "team of", "three of us", "four of us", "our team", "we were", "group"] },
      { label: "Is clear about your own role and what you personally delivered", anyOf: ["my role", "i was responsible", "i built", "i owned", "i handled", "i worked on", "i wrote"] },
      { label: "Describes how the team coordinated: git, reviews, stand-ups, task board", anyOf: ["git", "pull request", "review", "stand-up", "standup", "trello", "jira", "meeting", "branch"] },
      { label: "Ends with a result and something you learned", anyOf: ["result", "delivered", "shipped", "demo", "learned", "learnt", "lesson", "outcome"] },
    ],
    modelAnswer:
      "In my third year our team of three built a mock interview platform for a course. My role was the backend: I designed the database schema and wrote the booking logic, while the others handled the interface and the AI integration. We used Git branches with pull requests so that every change was reviewed by someone else, and a short stand-up twice a week. We delivered a working demo on time, and I learned that agreeing on interfaces early saves more time than any amount of fast coding.",
  },
  {
    id: "bh-04",
    difficulty: "INTERMEDIATE",
    topic: "Teamwork and conflict",
    text: "Describe a time you disagreed with a teammate. How did you handle it, and what was the outcome?",
    rubric: [
      { label: "Describes a specific disagreement without blaming the other person", anyOf: ["disagreed", "different opinion", "different view", "we disagreed", "conflict", "argued"] },
      { label: "Shows you listened and tried to understand their reasoning", anyOf: ["listened", "understand", "their point", "asked why", "their perspective", "their reasoning"] },
      { label: "Resolved it with evidence or a practical step: a prototype, data, a trial, a compromise", anyOf: ["prototype", "data", "compare", "tried both", "compromise", "agreed to", "benchmark", "trial"] },
      { label: "States the outcome and what it did for the relationship or the work", anyOf: ["outcome", "in the end", "as a result", "worked well", "relationship", "better", "since then"] },
    ],
    modelAnswer:
      "In a group project a teammate and I disagreed about whether to store resumes in the database or in object storage. I listened to why he preferred the database, which was simplicity, and then explained my concern about size. Instead of arguing, we each wrote a small prototype and compared upload time and cost with real files. Object storage clearly won, he agreed, and he even wrote the upload code. In the end we shipped faster, and since then we settle technical disagreements with a quick experiment rather than opinions.",
  },
  {
    id: "bh-05",
    difficulty: "INTERMEDIATE",
    topic: "Failure and feedback",
    text: "Tell me about a time you failed or made a significant mistake. What did you learn?",
    rubric: [
      { label: "Picks a real, specific mistake and owns it without blaming others", anyOf: ["my mistake", "i made", "i failed", "i missed", "i forgot", "i underestimated", "my fault", "i should have"] },
      { label: "Explains what you did to fix it and limit the damage", anyOf: ["fixed", "fix", "rolled back", "restored", "recovered", "told", "informed", "apolog", "stayed late"] },
      { label: "States a concrete lesson", anyOf: ["learned", "learnt", "lesson", "realised", "realized", "now i", "takeaway"] },
      { label: "Shows what you changed afterwards so it does not repeat", anyOf: ["since then", "next time", "now i always", "checklist", "added tests", "process", "from then on", "changed how"] },
    ],
    modelAnswer:
      "In my internship I pushed a change straight to the main branch without running the tests, and it broke the login page for an hour. It was my mistake and I said so immediately in the team channel, rolled the change back, and then fixed the real bug properly. The lesson was that confidence is not a substitute for checks. Since then I always open a pull request, wait for the tests, and I added a pre-push check to the project so that the same slip cannot happen to anyone else.",
  },
  {
    id: "bh-06",
    difficulty: "INTERMEDIATE",
    topic: "Handling ambiguity",
    text: "Tell me about a time the requirements were unclear or kept changing. What did you do?",
    rubric: [
      { label: "Describes the unclear situation concretely", anyOf: ["unclear", "vague", "kept changing", "changing requirements", "ambiguous", "not sure what", "no clear"] },
      { label: "Took the initiative to clarify: asked questions or wrote down assumptions", anyOf: ["asked", "clarif", "assumption", "wrote down", "confirmed", "checked with"] },
      { label: "Reduced risk by working in small steps and showing work early", anyOf: ["small", "prototype", "iteration", "iterate", "demo", "feedback", "milestone", "mvp", "early"] },
      { label: "Communicated the result and what you would repeat", anyOf: ["result", "delivered", "outcome", "worked", "agreed", "learned", "next time"] },
    ],
    modelAnswer:
      "For a college event app the requirements were vague and kept changing every week. I asked the organiser three specific questions, wrote down my assumptions in a short document and had her confirm them. Then I built the smallest useful version first, a prototype with only registration, and demoed it after a few days to get early feedback. That meant each change was small, and the final app was delivered on time. Next time I will start with the written assumptions even earlier.",
  },
  {
    id: "bh-07",
    difficulty: "ADVANCED",
    topic: "Ownership and leadership",
    text: "Tell me about a time you took the initiative or led something without having formal authority.",
    rubric: [
      { label: "Spotted a problem or opportunity nobody had assigned to you", anyOf: ["noticed", "nobody", "no one", "spotted", "realised", "realized", "saw that", "took the initiative", "on my own"] },
      { label: "Brought others along: proposed a plan, delegated or persuaded", anyOf: ["proposed", "suggested", "convinced", "organised", "organized", "delegat", "asked the team", "rallied", "persuaded"] },
      { label: "Took ownership of the outcome and handled difficulty or pushback", anyOf: ["owned", "responsible", "pushback", "concern", "resistance", "followed up", "took responsibility"] },
      { label: "Quantifies the result and reflects on it", anyOf: ["%", "percent", "hours", "reduced", "improved", "saved", "result", "learned", "would do differently"] },
    ],
    modelAnswer:
      "In our project I noticed that nobody owned deployments and every release was a manual, nerve-racking process. Without being asked, I proposed a simple automated pipeline, convinced the team with a short demo, and organised the work so each of us set up one stage. A few teammates were worried about breaking things, so I followed up personally and wrote a one-page guide. The result was that releases dropped from about an hour to ten minutes, and what I learned is to bring people along early rather than present a finished plan.",
  },
  {
    id: "bh-08",
    difficulty: "ADVANCED",
    topic: "Ownership and leadership",
    text: "Describe a time you had to make a decision with trade-offs and limited time, for example cutting scope before a deadline.",
    rubric: [
      { label: "Frames the options and the criteria, such as impact, risk and effort", anyOf: ["options", "criteria", "impact", "risk", "effort", "weighed", "trade-off", "tradeoff", "priorit"], min: 2 },
      { label: "Makes a clear decision: what was cut and what was protected", anyOf: ["must-have", "nice-to-have", "cut", "dropped", "postponed", "deferred", "core", "decided"], min: 2 },
      { label: "Communicates the decision to the people affected", anyOf: ["told", "explained", "communicated", "stakeholder", "mentor", "professor", "client", "aligned", "agreed with"] },
      { label: "Owns the result and says what you would do differently", anyOf: ["result", "outcome", "delivered", "shipped", "in hindsight", "would do differently", "retrospective", "learned"] },
    ],
    modelAnswer:
      "Two days before a course demo we realised we could not finish everything. I listed the options, weighed each feature by impact, risk and effort, and decided to protect the core flow of booking and feedback and to cut the admin screens and the dark-mode toggle. I explained the decision to my teammates and our professor so nobody was surprised, and we agreed on a short list of what we would show. We delivered a stable demo, and in hindsight I would have made that cut a week earlier with a simple priority list from the start.",
  },
];
