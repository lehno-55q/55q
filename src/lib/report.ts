import { categories, questions } from "./tests";

type StoredAnswer = { userId: string; question: number; value: unknown };

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 5;
  if (Array.isArray(value)) return Math.min(10, value.length + 4);
  return 5;
}

export function buildFallbackReport(answers: StoredAnswer[]) {
  const byQuestion = new Map<number, StoredAnswer[]>();
  for (const answer of answers) {
    byQuestion.set(answer.question, [...(byQuestion.get(answer.question) || []), answer]);
  }

  const categoryScores: Record<string, number[]> = {};
  for (const [questionId, pairAnswers] of byQuestion.entries()) {
    if (pairAnswers.length < 2) continue;
    const question = questions.find((item) => item.id === questionId);
    if (!question) continue;
    const diff = Math.abs(numberValue(pairAnswers[0].value) - numberValue(pairAnswers[1].value));
    const score = Math.max(35, Math.round(100 - diff * 9));
    categoryScores[question.category] = [...(categoryScores[question.category] || []), score];
  }

  const indicators = Object.entries(categories).map(([key, label]) => {
    const values = categoryScores[key] || [72];
    return { key, label, value: Math.round(values.reduce((a, b) => a + b, 0) / values.length) };
  });
  const compatibility = Math.round(indicators.reduce((sum, item) => sum + item.value, 0) / indicators.length);

  return {
    compatibility,
    title: compatibility >= 75 ? "Хорошая совместимость" : "Есть точки роста",
    indicators,
    freeSummary:
      "Вы хорошо понимаете друг друга в базовых вещах. Главная зона внимания - проговаривать ожидания до того, как они превращаются в обиды.",
    fullSummary:
      "Полный отчет показывает совпадения, расхождения и практичные рекомендации по общению, конфликтам, доверию, общим целям и близости.",
    recommendations: [
      "Выберите один вечер в неделю без телефонов и бытовых задач.",
      "Обсуждайте спорные темы через просьбы, а не через претензии.",
      "Сверьте ожидания по деньгам, отдыху и личному времени.",
    ],
  };
}

export async function generateDeepSeekReport(answers: StoredAnswer[]) {
  const fallback = buildFallbackReport(answers);
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return fallback;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Ты психологичный, бережный AI-аналитик отношений. Верни только JSON с полями compatibility, title, indicators, freeSummary, fullSummary, recommendations.",
          },
          {
            role: "user",
            content: JSON.stringify({ questions, answers, fallbackShape: fallback }),
          },
        ],
      }),
    });
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return content ? { ...fallback, ...JSON.parse(content) } : fallback;
  } catch {
    return fallback;
  }
}
