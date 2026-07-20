export type QuestionType = "scale" | "single" | "slider" | "multi" | "text";

export type Question = {
  id: number;
  type: QuestionType;
  category: "emotional" | "trust" | "conflict" | "goals" | "passion";
  title: string;
  options?: string[];
  leftLabel?: string;
  rightLabel?: string;
};

export const tests = [
  {
    slug: "couple-truth",
    title: "Ваша пара",
    subtitle: "Глубокий AI-анализ совместимости",
    questions: 55,
    enabled: true,
  },
  {
    slug: "compatibility",
    title: "Совместимость",
    subtitle: "Для тех, кто только знакомится",
    questions: 50,
    enabled: false,
  },
  {
    slug: "hot-18",
    title: "HOT 18+",
    subtitle: "Откровенный тест для взрослых",
    questions: 40,
    enabled: false,
  },
];

const baseQuestions: Question[] = [
  { id: 1, type: "scale", category: "emotional", title: "Насколько ты счастлив(а) в этих отношениях?", leftLabel: "Совсем нет", rightLabel: "Полностью" },
  { id: 2, type: "single", category: "trust", title: "Что для тебя самое важное в отношениях?", options: ["Доверие", "Любовь", "Страсть", "Стабильность", "Забота", "Свобода", "Общие цели", "Эмоциональная близость"] },
  { id: 3, type: "slider", category: "conflict", title: "Кто чаще первым идет мириться?", leftLabel: "Я", rightLabel: "Партнер" },
  { id: 4, type: "multi", category: "emotional", title: "Что заставляет тебя чувствовать себя любимым(ой)?", options: ["Слова", "Объятия", "Внимание", "Подарки", "Помощь", "Совместное время", "Физическая близость", "Забота в мелочах"] },
  { id: 5, type: "single", category: "conflict", title: "Вы сильно поссорились. Что ты скорее всего сделаешь?", options: ["Пойду выяснять отношения сразу", "Помолчу и буду копить", "Попробую пошутить", "Мне нужно время, чтобы остыть", "Сделаю вид, что ничего не произошло"] },
  { id: 6, type: "text", category: "trust", title: "Что ты хотел(а) бы сказать партнеру, но редко говоришь?" },
];

const prompts = [
  ["emotional", "Как часто тебе хочется проводить вечер только вдвоем?"],
  ["trust", "Насколько легко тебе говорить партнеру правду о сложных вещах?"],
  ["goals", "Насколько совпадают ваши планы на ближайший год?"],
  ["passion", "Насколько тебе хватает романтики и флирта?"],
  ["conflict", "Как быстро ты обычно отходишь после ссоры?"],
  ["emotional", "Насколько партнер замечает твое настроение без слов?"],
  ["trust", "Насколько спокойно ты относишься к личному пространству партнера?"],
  ["goals", "Насколько вы одинаково смотрите на деньги?"],
  ["passion", "Насколько часто ты проявляешь инициативу в близости?"],
  ["conflict", "Насколько тебе важно получить извинение словами?"],
];

export const questions: Question[] = [
  ...baseQuestions,
  ...Array.from({ length: 49 }, (_, index) => {
    const source = prompts[index % prompts.length];
    return {
      id: index + 7,
      type: "scale" as const,
      category: source[0] as Question["category"],
      title: source[1],
      leftLabel: "Мало",
      rightLabel: "Очень",
    };
  }),
];

export const categories = {
  emotional: "Эмоциональная близость",
  trust: "Доверие",
  conflict: "Конфликты",
  goals: "Общие цели",
  passion: "Страсть",
};
