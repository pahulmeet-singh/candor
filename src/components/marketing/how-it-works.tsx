const STEPS = [
  {
    title: "Book a slot",
    body: "Choose one of six categories and a difficulty, then pick a half-hour slot in the next two weeks. Add your résumé if you want questions about your own projects.",
  },
  {
    title: "Answer five questions",
    body: "Type your answers the way you would say them. Your work saves as you go, and you can move back to a question before you submit.",
  },
  {
    title: "Read the report",
    body: "Every answer comes back with the words that worked or fell short highlighted, a score out of ten, and a model answer to compare against.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
      <h2 id="how-heading" className="max-w-xl font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        Three steps and about half an hour.
      </h2>
      <ol className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-t border-line-strong pt-5">
            <span className="font-serif text-5xl leading-none font-semibold text-primary" aria-hidden="true">
              {index + 1}
            </span>
            <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
