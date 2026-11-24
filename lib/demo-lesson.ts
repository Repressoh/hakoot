export interface DemoCodeAnnotation {
  explanation: string;
  id: string;
  lineLabel: string;
}

export interface DemoCodeBlock {
  annotations: DemoCodeAnnotation[];
  code: string;
  language: string;
}

export interface DemoChoice {
  isCorrect: boolean;
  text: string;
}

export interface DemoTheoryStep {
  codeBlock: DemoCodeBlock;
  id: string;
  markdownContent: string;
  title: string;
  type: "theory";
}

export interface DemoQuizStep {
  choices: DemoChoice[];
  id: string;
  question: string;
  timeLimitSeconds: number;
  type: "quiz";
}

export type DemoStep = DemoTheoryStep | DemoQuizStep;

export interface DemoLesson {
  description: string;
  inviteCode: string;
  steps: DemoStep[];
  title: string;
}

export interface DemoBotScript {
  /** Choice index per quiz step id. */
  answers: Record<string, { choiceIndex: number; delayMs: number }>;
  id: string;
  name: string;
}

export const DEMO_INVITE_CODE = "DEMO42";

export const DEMO_BOTS: DemoBotScript[] = [
  {
    answers: {
      "quiz-1": { choiceIndex: 0, delayMs: 2800 },
      "quiz-2": { choiceIndex: 0, delayMs: 4200 },
    },
    id: "bot-maya",
    name: "Maya",
  },
  {
    answers: {
      "quiz-1": { choiceIndex: 0, delayMs: 5400 },
      "quiz-2": { choiceIndex: 1, delayMs: 3600 },
    },
    id: "bot-alex",
    name: "Alex",
  },
  {
    answers: {
      "quiz-1": { choiceIndex: 1, delayMs: 4100 },
      "quiz-2": { choiceIndex: 0, delayMs: 6500 },
    },
    id: "bot-sam",
    name: "Sam",
  },
];

const EN_LESSON: DemoLesson = {
  description:
    "A 2-minute interactive mini-lesson showing theory, annotated code, live quizzes, and real-time scoring.",
  inviteCode: DEMO_INVITE_CODE,
  steps: [
    {
      codeBlock: {
        annotations: [
          {
            explanation:
              "Defines a reusable function that takes two inputs: the original price and the discount percentage.",
            id: "a1",
            lineLabel: "Line 1",
          },
          {
            explanation:
              "Computes how much to subtract by multiplying the price by the percentage divided by 100.",
            id: "a2",
            lineLabel: "Line 2",
          },
          {
            explanation:
              "Sends the final discounted price back to whoever called the function.",
            id: "a3",
            lineLabel: "Line 3",
          },
        ],
        code: `def apply_discount(price, percent):
    saved = price * (percent / 100)
    return price - saved

total = apply_discount(100, 20)`,
        language: "python",
      },
      id: "theory-1",
      markdownContent:
        "### Functions & Return Values\n\nA **function** bundles reusable logic under one name. It accepts inputs (**parameters**) and sends back a result with `return`.",
      title: "Functions & Return Values",
      type: "theory",
    },
    {
      choices: [
        { isCorrect: true, text: "80" },
        { isCorrect: false, text: "20" },
        { isCorrect: false, text: "120" },
        { isCorrect: false, text: "100" },
      ],
      id: "quiz-1",
      question: "What value does apply_discount(100, 20) return?",
      timeLimitSeconds: 20,
      type: "quiz",
    },
    {
      codeBlock: {
        annotations: [
          {
            explanation:
              "Stores four student test scores in a list so we can inspect each one in order.",
            id: "b1",
            lineLabel: "Line 1",
          },
          {
            explanation:
              "Loops through every score in the list one by one, checking if it is at least 80.",
            id: "b2",
            lineLabel: "Lines 4–5",
          },
          {
            explanation:
              "Adds 1 to high_scores only when the condition is true (92 and 88 both pass).",
            id: "b3",
            lineLabel: "Line 6",
          },
        ],
        code: `scores = [65, 92, 78, 88]
high_scores = 0

for score in scores:
    if score >= 80:
        high_scores += 1`,
        language: "python",
      },
      id: "theory-2",
      markdownContent:
        "### Loops & Conditions\n\nCombining a `for` loop with an `if` check lets a program scan a list and count only the items that match a rule.",
      title: "Loops & Conditions",
      type: "theory",
    },
    {
      choices: [
        { isCorrect: true, text: "2" },
        { isCorrect: false, text: "3" },
        { isCorrect: false, text: "4" },
        { isCorrect: false, text: "1" },
      ],
      id: "quiz-2",
      question: "What is the value of high_scores after the loop finishes?",
      timeLimitSeconds: 20,
      type: "quiz",
    },
  ],
  title: "Python Quickstart — Open Day Demo",
};

const IT_LESSON: DemoLesson = {
  description:
    "Una mini-lezione interattiva di 2 minuti con teoria, codice annotato, quiz a tempo e classifica dal vivo.",
  inviteCode: DEMO_INVITE_CODE,
  steps: [
    {
      codeBlock: {
        annotations: [
          {
            explanation:
              "Definisce una funzione riutilizzabile che riceve due parametri: il prezzo iniziale e la percentuale di sconto.",
            id: "a1",
            lineLabel: "Riga 1",
          },
          {
            explanation:
              "Calcola quanto sottrarre moltiplicando il prezzo per la percentuale divisa per 100.",
            id: "a2",
            lineLabel: "Riga 2",
          },
          {
            explanation:
              "Restituisce il prezzo finale scontato a chi ha chiamato la funzione.",
            id: "a3",
            lineLabel: "Riga 3",
          },
        ],
        code: `def apply_discount(price, percent):
    saved = price * (percent / 100)
    return price - saved

total = apply_discount(100, 20)`,
        language: "python",
      },
      id: "theory-1",
      markdownContent:
        "### Funzioni e Valori di Ritorno\n\nUna **funzione** racchiude logica riutilizzabile sotto un solo nome. Riceve degli input (**parametri**) e restituisce un risultato con `return`.",
      title: "Funzioni e Valori di Ritorno",
      type: "theory",
    },
    {
      choices: [
        { isCorrect: true, text: "80" },
        { isCorrect: false, text: "20" },
        { isCorrect: false, text: "120" },
        { isCorrect: false, text: "100" },
      ],
      id: "quiz-1",
      question: "Quale valore restituisce apply_discount(100, 20)?",
      timeLimitSeconds: 20,
      type: "quiz",
    },
    {
      codeBlock: {
        annotations: [
          {
            explanation:
              "Salva quattro voti in una lista per poterli analizzare uno alla volta.",
            id: "b1",
            lineLabel: "Riga 1",
          },
          {
            explanation:
              "Scorre ogni voto nella lista con un ciclo for e controlla se è almeno 80.",
            id: "b2",
            lineLabel: "Righe 4–5",
          },
          {
            explanation:
              "Incrementa high_scores di 1 solo quando la condizione è vera (92 e 88).",
            id: "b3",
            lineLabel: "Riga 6",
          },
        ],
        code: `scores = [65, 92, 78, 88]
high_scores = 0

for score in scores:
    if score >= 80:
        high_scores += 1`,
        language: "python",
      },
      id: "theory-2",
      markdownContent:
        "### Cicli e Condizioni\n\nCombinare un ciclo `for` con un controllo `if` permette al programma di scorrere una lista e contare solo gli elementi che rispettano una regola.",
      title: "Cicli e Condizioni",
      type: "theory",
    },
    {
      choices: [
        { isCorrect: true, text: "2" },
        { isCorrect: false, text: "3" },
        { isCorrect: false, text: "4" },
        { isCorrect: false, text: "1" },
      ],
      id: "quiz-2",
      question: "Qual è il valore di high_scores al termine del ciclo?",
      timeLimitSeconds: 20,
      type: "quiz",
    },
  ],
  title: "Python Quickstart — Demo Open Day",
};

/** Returns the curated open-day demo lesson localized for the given locale. */
export function getDemoLesson(locale: string): DemoLesson {
  if (locale === "it" || locale.startsWith("it-")) {
    return IT_LESSON;
  }
  return EN_LESSON;
}
