"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Heart, Lock, Menu, Send, Shield, Sparkles, UserRound } from "lucide-react";
import { botUsername, reportPriceRub } from "@/lib/env";
import { questions, tests, categories } from "@/lib/tests";
import "./ui.css";

type Answer = { id: string; userId: string; question: number; value: unknown };
type Member = { id: string; userId: string; user?: { displayName?: string | null } };
type Pair = { id: string; name: string; inviteCode: string; members: Member[] };
type Session = {
  id: string;
  answers?: Answer[];
  freeReport?: Report | null;
  fullReport?: Report | null;
  fullUnlocked?: boolean;
};
type Report = {
  compatibility: number;
  title: string;
  freeSummary: string;
  fullSummary: string;
  indicators?: { key: string; label: string; value: number }[];
  recommendations?: string[];
};
type AppState = {
  user: { id: string; displayName?: string | null; age?: number | null } | null;
  pair?: Pair | null;
  session?: Session | null;
} | null;

async function api(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export default function Home() {
  const [state, setState] = useState<AppState>(null);
  const [screen, setScreen] = useState("home");
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const inviteFromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("invite") : "";

  const user = state?.user;
  const pair = state?.pair;
  const session = state?.session;
  const members = pair?.members || [];
  const userAnswers = useMemo(() => session?.answers?.filter((answer) => answer.userId === user?.id) || [], [session, user]);
  const partnerReady = Boolean(session && members.length > 1 && (session.answers?.filter((answer) => answer.userId !== user?.id).length || 0) >= questions.length);
  const mineReady = userAnswers.length >= questions.length;
  const report = session?.freeReport || session?.fullReport;

  async function refresh() {
    setState(await api("/api/me"));
  }

  useEffect(() => {
    let active = true;
    api("/api/me").then((nextState) => {
      if (active) setState(nextState);
    });
    return () => {
      active = false;
    };
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function auth() {
    const tg = (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (tg?.initData) {
      await run(() => api("/api/auth/telegram", { initData: tg.initData }));
    } else {
      await run(() => api("/api/auth/dev", {}));
    }
  }

  async function startTest() {
    if (!user) return setScreen("auth");
    if (!user.displayName || !user.age) return setScreen("profile");
    if (!pair || members.length < 2) return setScreen("pair");
    const created = await api("/api/session", {});
    setState({ ...state, session: created });
    setScreen("test");
  }

  async function saveCurrent(value: unknown) {
    const activeSession = session || (await api("/api/session", {}));
    await api("/api/answer", { sessionId: activeSession.id, question: questions[current].id, value });
    setAnswers({ ...answers, [questions[current].id]: value });
    if (current < questions.length - 1) setCurrent(current + 1);
    else {
      await refresh();
      setScreen("result");
    }
  }

  return (
    <main className="shell">
      <section className="phone">
        <header className="topbar">
          <div className="brand"><Heart size={22} /> 55Q</div>
          <button className="iconButton" aria-label="menu"><Menu size={21} /></button>
        </header>

        {screen === "home" && (
          <>
            <section className="intro">
              <h1>Узнайте правду <span>о ваших отношениях</span></h1>
              <p>Пройдите тест вместе с партнером и получите персональный DeepSeek-анализ вашей совместимости.</p>
              <div className="coupleArt">💑</div>
              <div className="benefits">
                <p><Heart size={18} /> 3 уникальных теста для любых отношений</p>
                <p><Sparkles size={18} /> AI-анализ и точные результаты</p>
                <p><Shield size={18} /> Ответы скрыты до завершения обоими</p>
              </div>
              <button className="primary" onClick={startTest} disabled={busy}>
                Создать пару и начать тест
              </button>
            </section>
          </>
        )}

        {screen === "tests" && <TestList onStart={startTest} />}

        {screen === "auth" && (
          <Panel title="Войдите через Telegram">
            <p>Так мы привяжем ответы к вашему профилю и отправим уведомление, когда пара будет готова.</p>
            <button className="primary" onClick={auth} disabled={busy}><Send size={18} /> Продолжить через Telegram</button>
            <small>Для локальной разработки включен dev-вход. В Telegram Mini App кнопка использует initData.</small>
          </Panel>
        )}

        {screen === "profile" && (
          <ProfileForm onSubmit={(data) => run(() => api("/api/profile", data).then(() => setScreen(inviteFromUrl ? "pair" : "home")))} />
        )}

        {screen === "pair" && (
          <PairForm
            invite={inviteFromUrl || ""}
            pair={pair}
            members={members}
            onSubmit={(data) => run(() => api("/api/pair", data))}
          />
        )}

        {screen === "test" && session && (
          <QuestionView
            key={current}
            index={current}
            total={questions.length}
            onAnswer={saveCurrent}
            disabled={busy}
          />
        )}

        {screen === "result" && (
          <ResultView
            report={report}
            mineReady={mineReady}
            partnerReady={partnerReady}
            unlocked={session?.fullUnlocked}
            sessionId={session?.id}
            onUnlock={(sessionId: string) => run(() => api("/api/payment/mock", { sessionId }))}
          />
        )}

        <nav className="bottomNav">
          <button onClick={() => setScreen("home")}><Heart size={18} /> Главная</button>
          <button onClick={() => setScreen("tests")}><Sparkles size={18} /> Тесты</button>
          <button onClick={() => setScreen(user ? "profile" : "auth")}><UserRound size={18} /> Профиль</button>
        </nav>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

function TestList({ onStart }: { onStart: () => void }) {
  return (
    <section className="tests">
      <h2>Выберите тест</h2>
      {tests.map((test, index) => (
        <button className={`testCard tone${index}`} key={test.slug} disabled={!test.enabled} onClick={onStart}>
          <span><b>{test.title}</b><small>{test.subtitle}</small><em>{test.questions} вопросов</em></span>
          <span className="testArt">{index === 0 ? "💞" : index === 1 ? "💜" : "🔥"}</span>
        </button>
      ))}
    </section>
  );
}

function ProfileForm({ onSubmit }: { onSubmit: (data: { displayName: string; age: number }) => void }) {
  const [displayName, setName] = useState("");
  const [age, setAge] = useState(18);
  return (
    <Panel title="Создайте профиль">
      <input placeholder="Ваше имя или ник" value={displayName} onChange={(event) => setName(event.target.value)} />
      <input type="number" min={18} max={99} value={age} onChange={(event) => setAge(Number(event.target.value))} />
      <button className="primary" onClick={() => onSubmit({ displayName, age })}>Сохранить</button>
    </Panel>
  );
}

function PairForm({ invite, pair, members, onSubmit }: { invite: string; pair?: Pair | null; members: Member[]; onSubmit: (data: { name?: string; mode?: "join"; inviteCode?: string }) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(invite);
  const share = pair ? `${location.origin}/?invite=${pair.inviteCode}` : "";
  return (
    <Panel title={pair ? "Пригласите партнера" : "Создайте пару"}>
      {pair ? (
        <>
          <div className="inviteBox"><span>{pair.inviteCode}</span><button onClick={() => navigator.clipboard.writeText(pair.inviteCode)}><Copy size={18} /></button></div>
          <a className="primary linkButton" href={`https://t.me/${botUsername}?start=${pair.inviteCode}`}><Send size={18} /> Отправить через Telegram</a>
          <small>{members.length < 2 ? "Партнер должен вступить по ссылке или коду, чтобы тест стал доступен." : "Пара создана. Функционал доступен."}</small>
          {share && <button className="secondary" onClick={() => navigator.clipboard.writeText(share)}>Скопировать ссылку</button>}
        </>
      ) : (
        <>
          <input placeholder="Название пары" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="primary" onClick={() => onSubmit({ name })}>Создать пару</button>
          <div className="divider">или</div>
          <input placeholder="Инвайт код" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          <button className="secondary" onClick={() => onSubmit({ mode: "join", inviteCode: code })}>Вступить по коду</button>
        </>
      )}
    </Panel>
  );
}

function QuestionView({ index, total, onAnswer, disabled }: { index: number; total: number; onAnswer: (value: unknown) => void; disabled: boolean }) {
  const question = questions[index];
  const [value, setValue] = useState<unknown>(question.type === "multi" ? [] : question.type === "text" ? "" : 8);
  return (
    <Panel title={`${index + 1}/${total}`}>
      <small>{categories[question.category]}</small>
      <h3>{question.title}</h3>
      {question.type === "scale" && <Scale value={Number(value)} onChange={setValue} />}
      {question.type === "slider" && <input type="range" min={1} max={10} value={Number(value)} onChange={(e) => setValue(Number(e.target.value))} />}
      {question.type === "text" && <textarea placeholder="Напишите здесь..." value={String(value)} onChange={(e) => setValue(e.target.value)} />}
      {(question.type === "single" || question.type === "multi") && (
        <div className="chips">
          {question.options?.map((option) => {
            const selected = question.type === "multi" ? (value as string[]).includes(option) : value === option;
            return <button className={selected ? "selected" : ""} key={option} onClick={() => question.type === "multi" ? setValue(selected ? (value as string[]).filter((x) => x !== option) : [...(value as string[]), option]) : setValue(option)}>{option}</button>;
          })}
        </div>
      )}
      <button className="primary" disabled={disabled} onClick={() => onAnswer(value)}>Ответить</button>
    </Panel>
  );
}

function Scale({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="scale">{Array.from({ length: 10 }, (_, i) => <button className={value === i + 1 ? "selected" : ""} key={i} onClick={() => onChange(i + 1)}>{i + 1}</button>)}</div>;
}

function ResultView({
  report,
  mineReady,
  partnerReady,
  unlocked,
  sessionId,
  onUnlock,
}: {
  report?: Report | null;
  mineReady: boolean;
  partnerReady: boolean | null;
  unlocked?: boolean;
  sessionId?: string;
  onUnlock: (sessionId: string) => void;
}) {
  if (!report) {
    return <Panel title="Ожидаем завершения"><p>{mineReady ? "Ваши ответы сохранены. Осталось дождаться партнера." : "Пройдите тест, чтобы открыть результат."}</p><p>{partnerReady ? "Партнер уже готов." : "Ответы партнера скрыты до завершения теста."}</p></Panel>;
  }
  return (
    <section className="result">
      <h2>Ваш результат</h2>
      <div className="score"><Heart size={88} /><strong>{report.compatibility}%</strong></div>
      <h3>{report.title}</h3>
      <p>{report.freeSummary}</p>
      <div className="indicators">{report.indicators?.map((item) => <p key={item.key}><span>{item.label}</span><b>{item.value}%</b><i style={{ width: `${item.value}%` }} /></p>)}</div>
      {unlocked ? <div className="full"><h3>Полный отчет</h3><p>{report.fullSummary}</p>{report.recommendations?.map((item) => <small key={item}>{item}</small>)}</div> : <button className="primary" disabled={!sessionId} onClick={() => sessionId && onUnlock(sessionId)}>Смотреть полный отчет {reportPriceRub} ₽ <Lock size={16} /></button>}
    </section>
  );
}
