import type { BankQuestion } from "./types";

export const DSA_QUESTIONS: readonly BankQuestion[] = [
  {
    id: "ds-01",
    difficulty: "BEGINNER",
    topic: "Complexity analysis",
    text: "What is the time complexity of searching in an unsorted array, in a sorted array, and in a hash map? Explain why.",
    rubric: [
      { label: "Unsorted array: linear scan, O(n)", anyOf: ["o(n)", "linear"] },
      { label: "Sorted array: binary search halves the range, O(log n)", anyOf: ["o(log n)", "binary search", "logarithmic", "halv"] },
      { label: "Hash map: O(1) on average via hashing, worse with collisions", anyOf: ["o(1)", "constant", "hash function", "collision"] },
      { label: "Mentions the trade-offs: memory, the cost of sorting", anyOf: ["extra memory", "space", "sorting cost", "o(n log n)", "trade-off"] },
    ],
    modelAnswer:
      "In an unsorted array you must check elements one by one, so search is O(n). If the array is sorted, binary search halves the range each step, giving O(log n), though sorting costs O(n log n) up front. A hash map computes a hash of the key to jump to a bucket, so lookups are O(1) on average, degrading towards O(n) when many keys collide. The trade-off is extra memory and no inherent ordering.",
  },
  {
    id: "ds-02",
    difficulty: "BEGINNER",
    topic: "Arrays and strings",
    text: "How would you check whether a string is a palindrome? What edge cases would you consider?",
    rubric: [
      { label: "Uses two pointers moving inward from both ends", anyOf: ["two pointer", "two-pointer", "both ends", "left and right", "start and end"] },
      { label: "States O(n) time and O(1) extra space", anyOf: ["o(n)", "o(1)", "linear", "constant space"] },
      { label: "Lists edge cases: empty string, case, punctuation, spaces, Unicode", anyOf: ["case", "punctuation", "space", "empty", "single", "non-alphanumeric", "unicode"] },
    ],
    modelAnswer:
      "Use two pointers, one at each end, moving inward and comparing characters; if any pair differs it is not a palindrome. That is O(n) time and O(1) extra space, better than reversing and comparing, which uses O(n) space. Edge cases: an empty or one-character string (true), mixed case, spaces and punctuation if the problem ignores them (skip non-alphanumeric characters), and Unicode where one visible character can be several code units.",
  },
  {
    id: "ds-03",
    difficulty: "BEGINNER",
    topic: "Stacks, queues and hash maps",
    text: "Explain a stack and a queue, and give a real use for each.",
    rubric: [
      { label: "Stack is last-in, first-out", anyOf: ["lifo", "last in", "last-in"] },
      { label: "Queue is first-in, first-out", anyOf: ["fifo", "first in", "first-in"] },
      { label: "Gives real uses: undo, call stack, bracket matching; BFS, task scheduling, print queue", anyOf: ["undo", "call stack", "parenthes", "bracket", "bfs", "breadth", "task queue", "print", "scheduler", "message queue"] },
      { label: "Core operations are O(1)", anyOf: ["push", "pop", "enqueue", "dequeue", "o(1)"] },
    ],
    modelAnswer:
      "A stack is last-in, first-out: you push and pop at one end. It models the call stack, an undo history and bracket matching. A queue is first-in, first-out: you enqueue at the back and dequeue from the front, as in a print queue, a task scheduler or breadth-first search. Both support their core operations in O(1) when built on a linked list or a circular buffer.",
  },
  {
    id: "ds-04",
    difficulty: "INTERMEDIATE",
    topic: "Stacks, queues and hash maps",
    text: "Given an array of integers and a target, return the indices of two numbers that add up to the target. Walk me through your approach.",
    rubric: [
      { label: "Starts from the brute force: all pairs, O(n squared)", anyOf: ["brute force", "o(n^2)", "o(n²)", "nested loop", "two loops"] },
      { label: "Improves with a hash map of values seen so far, looking up the complement", anyOf: ["hash map", "hashmap", "dictionary", "complement", "target minus", "seen"] },
      { label: "States O(n) time and O(n) space", anyOf: ["o(n)", "linear"] },
      { label: "Covers edge cases: duplicates, reusing an element, no solution, negatives", anyOf: ["duplicate", "same element", "no solution", "twice", "negative"] },
    ],
    modelAnswer:
      "The brute force checks every pair, which is O(n²). Better: scan once, and for each number x look up target minus x in a hash map of values seen so far (value to index). If it is there, return both indices; otherwise store x. That is O(n) time and O(n) space. Edge cases: duplicates such as [3, 3] with target 6, not using the same element twice, negative numbers, and what to return when no pair exists.",
  },
  {
    id: "ds-05",
    difficulty: "INTERMEDIATE",
    topic: "Trees and graphs",
    text: "Explain breadth-first search versus depth-first search. When would you pick each?",
    rubric: [
      { label: "BFS explores level by level using a queue", anyOf: ["queue", "level", "layer"] },
      { label: "DFS goes deep first using recursion or a stack, then backtracks", anyOf: ["stack", "recursion", "recursive", "deep", "backtrack"] },
      { label: "Matches each to uses: shortest path in unweighted graphs; cycles, topological order, components", anyOf: ["shortest path", "unweighted", "cycle", "topological", "connected component", "backtracking"] },
      { label: "States O(V+E) and tracking visited nodes", anyOf: ["o(v+e)", "o(v + e)", "visited", "vertices and edges"] },
    ],
    modelAnswer:
      "BFS explores a graph level by level using a queue, so the first time it reaches a node in an unweighted graph is along a shortest path. DFS goes as deep as possible along one branch using recursion or an explicit stack, then backtracks; it suits cycle detection, topological sort, connected components and exhaustive search. Both visit each vertex and edge once, O(V+E), as long as you track visited nodes.",
  },
  {
    id: "ds-06",
    difficulty: "INTERMEDIATE",
    topic: "Recursion and dynamic programming",
    text: "What is dynamic programming? Use Fibonacci numbers or climbing stairs to contrast memoisation with tabulation.",
    rubric: [
      { label: "Names overlapping subproblems and optimal substructure", anyOf: ["overlapping", "optimal substructure", "subproblem"] },
      { label: "Memoisation: top-down recursion with a cache", anyOf: ["memo", "cache", "top-down", "top down"] },
      { label: "Tabulation: bottom-up, filling a table iteratively", anyOf: ["tabulat", "bottom-up", "bottom up", "table", "iterative"] },
      { label: "Shows the gain: exponential to linear, and the O(1) space trick", anyOf: ["exponential", "o(2^n)", "o(n)", "two variables", "o(1) space"] },
    ],
    modelAnswer:
      "Dynamic programming solves problems with overlapping subproblems and optimal substructure by solving each subproblem once. Naive recursive Fibonacci is exponential because it recomputes the same values. Memoisation keeps the recursion but caches results top-down; tabulation fills a table bottom-up from the base cases. Both give O(n) time, and since each state needs only the previous two, tabulation can drop to O(1) space with two variables.",
  },
  {
    id: "ds-07",
    difficulty: "ADVANCED",
    topic: "Stacks, queues and hash maps",
    text: "Design an LRU cache with O(1) get and put. Explain the data structures you would combine.",
    rubric: [
      { label: "Combines a hash map with a doubly linked list", anyOf: ["hash map", "hashmap", "doubly linked", "linked list"], min: 2 },
      { label: "Explains why: the map gives O(1) lookup, the list gives O(1) reordering and eviction", anyOf: ["o(1)", "constant time"] },
      { label: "Describes the operations: move to front on access, evict the tail", anyOf: ["most recent", "move to the front", "head", "tail", "evict", "least recently"] },
      { label: "Handles details: capacity, updating a key, sentinel nodes, thread safety", anyOf: ["capacity", "update", "existing key", "sentinel", "dummy", "thread", "lock"] },
    ],
    modelAnswer:
      "Combine a hash map from key to node with a doubly linked list ordered by recency. The map gives O(1) lookup; the list gives O(1) removal and insertion once you hold a node pointer. On get, move the node to the head; on put, update or insert at the head and, if over capacity, evict the tail (the least recently used) and delete its key from the map. Sentinel head and tail nodes remove edge cases, and a concurrent cache needs locking.",
  },
  {
    id: "ds-08",
    difficulty: "ADVANCED",
    topic: "Sorting and searching",
    text: "Explain how merge sort and quicksort work and compare their complexity, stability and practical use.",
    rubric: [
      { label: "Merge sort: split, sort halves, merge; O(n log n) always; O(n) extra space", anyOf: ["divide", "merge", "halves", "o(n log n)", "extra space", "o(n) space"], min: 2 },
      { label: "Quicksort: pivot and partition; O(n log n) average, O(n squared) worst", anyOf: ["pivot", "partition", "o(n^2)", "o(n²)", "worst case", "average"], min: 2 },
      { label: "Contrasts stability and in-place sorting", anyOf: ["stable", "in-place", "in place"] },
      { label: "Mentions practical choices: random pivot, insertion sort for small arrays, Timsort", anyOf: ["random pivot", "median", "insertion sort", "timsort", "cache", "built-in"] },
    ],
    modelAnswer:
      "Merge sort splits the array in half, sorts each half recursively and merges them: O(n log n) in every case, stable, but it needs O(n) extra space. Quicksort picks a pivot, partitions into smaller and larger parts and recurses: O(n log n) on average and O(n²) in the worst case, such as an already sorted array with a naive pivot; it is in place but not stable. Random or median-of-three pivots avoid the worst case, and library sorts like Timsort hybridise for stability and speed.",
  },
];
