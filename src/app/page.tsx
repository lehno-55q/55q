"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Check,
  Copy,
  Gift,
  Heart,
  Lock,
  MessageCircle,
  Send,
  Shield,
} from "lucide-react";
import { botUsername, reportPriceRub } from "@/lib/env";
import { categories, questions, tests } from "@/lib/tests";
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
  user: { id: string; displayName?: string | null; telegramName?: string | null; firstName?: string | null; gender?: string | null; age?: number | null } | null;
  pair?: Pair | null;
  session?: Session | null;
} | null;

type Screen = "home" | "tests" | "profile" | "pair" | "test" | "result";
type ButtonVariant = "primary" | "secondary" | "danger" | "outline" | "ghost";

function formatInviteCode(code: string) {
  const clean = code.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)} - ${clean.slice(3)}` : clean;
}

async function api(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export default function HomePage() {
  const [state, setState] = useState<AppState>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [environmentReady, setEnvironmentReady] = useState(false);
  const [browserOnly, setBrowserOnly] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const inviteFromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("invite") : "";

  const user = state?.user;
  const pair = state?.pair;
  const session = state?.session;
  const members = pair?.members || [];
  const userAnswers = useMemo(() => session?.answers?.filter((answer) => answer.userId === user?.id) || [], [session, user]);
  const partnerReady = Boolean(session && members.length > 1 && (session.answers?.filter((answer) => answer.userId !== user?.id).length || 0) >= questions.length);
  const mineReady = userAnswers.length >= questions.length;
  const report = session?.freeReport || session?.fullReport;
  const userLabel = user?.displayName || user?.telegramName || user?.firstName || "";

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

  useEffect(() => {
    if (!environmentReady || browserOnly || !state || !user) return;
    let nextScreen: Screen | null = null;
    if (!user.displayName || !user.gender || !user.age) {
      nextScreen = "profile";
    } else if (!pair || members.length < 2) {
      nextScreen = "pair";
    } else if (screen === "profile" || screen === "pair") {
      nextScreen = "home";
    }
    if (nextScreen && nextScreen !== screen) {
      const id = window.setTimeout(() => setScreen(nextScreen), 0);
      return () => window.clearTimeout(id);
    }
  }, [browserOnly, environmentReady, members.length, pair, screen, state, user]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function tryMiniAppAuth() {
      const tg = (window as Window & { Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } } }).Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
      if (!tg?.initData) {
        if (attempts < 8 && !cancelled) {
          attempts += 1;
          window.setTimeout(tryMiniAppAuth, 250);
        } else if (!cancelled) {
          setBrowserOnly(true);
          setEnvironmentReady(true);
        }
        return;
      }

      setBrowserOnly(false);
      setEnvironmentReady(true);
      if (user) return;
      setBusy(true);
      try {
        await api("/api/auth/telegram", { initData: tg.initData });
        if (!cancelled) {
          await refresh();
          setToast({ tone: "success", text: "Вход через Telegram выполнен" });
        }
      } catch (error) {
        if (!cancelled) {
          setToast({ tone: "danger", text: error instanceof Error ? error.message : "Не удалось войти через Mini App" });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    tryMiniAppAuth();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function run(action: () => Promise<void>, successText?: string) {
    setBusy(true);
    setToast(null);
    try {
      await action();
      await refresh();
      if (successText) setToast({ tone: "success", text: successText });
    } catch (error) {
      setToast({ tone: "danger", text: error instanceof Error ? error.message : "Что-то пошло не так" });
    } finally {
      setBusy(false);
    }
  }

  async function startTest() {
    if (!user) {
      setToast({ tone: "warning", text: "Откройте приложение внутри Telegram, чтобы продолжить" });
      return;
    }
    if (!user.displayName || !user.gender || !user.age) return setScreen("profile");
    if (!pair || members.length < 2) return setScreen("pair");
    const created = await api("/api/session", {});
    setState({ ...state, session: created });
    setScreen("test");
  }

  async function saveCurrent(value: unknown) {
    await run(async () => {
      const activeSession = session || (await api("/api/session", {}));
      await api("/api/answer", { sessionId: activeSession.id, question: questions[current].id, value });
      setAnswers({ ...answers, [questions[current].id]: value });
      if (current < questions.length - 1) {
        setCurrent(current + 1);
      } else {
        setScreen("result");
      }
    }, "Ответ сохранён");
  }

  function navigate(nextScreen: Screen) {
    setScreen(nextScreen);
  }

  if (!environmentReady) {
    return <EnvironmentLoadingScreen />;
  }

  if (browserOnly) {
    return <BrowserOnlyScreen />;
  }

  return (
    <main className="appShell">
      <section className="appFrame" aria-label="55 Вопросов application">
        <AppHeader
          screen={screen}
          userName={userLabel}
          onBack={screen === "home" ? undefined : () => navigate("home")}
        />

        {toast && <Toast tone={toast.tone}>{toast.text}</Toast>}

        {screen === "home" && <HomeScreen busy={busy} onStart={startTest} onTests={() => navigate("tests")} />}
        {screen === "tests" && <TestsScreen onStart={startTest} />}
        {screen === "profile" && (
          <ProfileScreen
            busy={busy}
            onSubmit={(data) =>
              run(async () => {
                await api("/api/profile", data);
                setScreen("pair");
              }, "Профиль сохранён")
            }
          />
        )}
        {screen === "pair" && (
          <PairScreen
            pair={pair}
            members={members}
            invite={inviteFromUrl || ""}
            busy={busy}
            onSubmit={(data) => run(() => api("/api/pair", data), data.mode === "join" ? "Вы вступили в пару" : "Пара создана")}
          />
        )}
        {screen === "test" && session && (
          <QuestionScreen key={current} index={current} total={questions.length} disabled={busy} onAnswer={saveCurrent} />
        )}
        {screen === "result" && (
          <ResultScreen
            report={report}
            mineReady={mineReady}
            partnerReady={partnerReady}
            unlocked={session?.fullUnlocked}
            sessionId={session?.id}
            onUnlock={(sessionId) => run(() => api("/api/payment/mock", { sessionId }), "Полный отчёт открыт")}
          />
        )}
      </section>
    </main>
  );
}

function AppHeader({
  screen,
  userName,
  onBack,
}: {
  screen: Screen;
  userName: string;
  onBack?: () => void;
}) {
  const title = screen === "home" ? "55 Вопросов" : screen === "tests" ? "Выберите тест" : screen === "pair" ? "Пригласите партнёра" : screen === "result" ? "Ваш результат" : "55 Вопросов";

  return (
    <header className="appHeader">
      <div className="headerLeft">
        {onBack ? (
          <IconButton label="Назад" onClick={onBack}>
            <ArrowLeft size={20} />
          </IconButton>
        ) : (
          <span className="brandMark" aria-hidden="true">
            <Heart size={20} />
          </span>
        )}
        <div>
          <p className="eyebrow">{userName || "55 Вопросов"}</p>
          <h1 className="headerTitle">{title}</h1>
        </div>
      </div>
    </header>
  );
}

function HomeScreen({ busy, onStart, onTests }: { busy: boolean; onStart: () => void; onTests: () => void }) {
  return (
    <div className="screenStack">
      <section className="heroPanel" aria-labelledby="home-title">
        <div className="heroCopy">
          <h2 id="home-title">
            Узнайте правду <span>о ваших отношениях</span>
          </h2>
          <p>Пройдите тест вместе с партнёром и получите персональный DeepSeek-анализ совместимости.</p>
        </div>
        <DecorativeArt kind="couple" />
        <Card className="benefitCard">
          <Feature icon={<Heart size={20} />} title="3 уникальных теста" text="Для разных этапов отношений" />
          <Feature icon={<Brain size={20} />} title="AI-анализ" text="Краткий результат сразу после прохождения" />
          <Feature icon={<Shield size={20} />} title="Конфиденциально" text="Ответы скрыты до завершения обоими" />
        </Card>
        <Button loading={busy} onClick={onStart}>
          Создать пару и начать тест
        </Button>
        <Button variant="ghost" onClick={onTests}>
          Посмотреть все тесты
        </Button>
      </section>
    </div>
  );
}

function EnvironmentLoadingScreen() {
  return (
    <main className="appShell browserOnlyShell">
      <section className="appFrame" aria-label="Проверка Telegram Mini App">
        <Card className="browserOnlyCard">
          <span className="brandMark browserOnlyIcon" aria-hidden="true">
            <Heart size={24} />
          </span>
          <SectionIntro title="55 Вопросов" text="Запускаем приложение..." />
        </Card>
      </section>
    </main>
  );
}

function BrowserOnlyScreen() {
  return (
    <main className="appShell browserOnlyShell">
      <section className="appFrame" aria-label="55 Вопросов">
        <Card className="browserOnlyCard">
          <span className="brandMark browserOnlyIcon" aria-hidden="true">
            <Heart size={24} />
          </span>
          <SectionIntro
            title="55 Вопросов"
            text="Извините, в данный момент сервис «55 Вопросов» не работает через обычный браузер. Пожалуйста, откройте приложение в Telegram."
          />
          <Button asLink href={`https://t.me/${botUsername}`} icon={<Send size={18} />}>
            Перейти к боту
          </Button>
        </Card>
      </section>
    </main>
  );
}

function TestsScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="screenStack">
      <SectionIntro title="Выберите тест" text="В первой версии активен основной тест для пары. Остальные сценарии уже зарезервированы в интерфейсе." />
      <div className="testGrid">
        {tests.map((test, index) => (
          <button className={`testCard testTone${index}`} key={test.slug} disabled={!test.enabled} onClick={onStart}>
            <span className="testText">
              <strong>{test.title}</strong>
              <span>{test.subtitle}</span>
              <Badge tone={index === 0 ? "pink" : index === 1 ? "purple" : "coral"}>{test.questions} вопросов</Badge>
            </span>
            <DecorativeArt kind={index === 0 ? "couple-small" : index === 1 ? "date" : "hot"} />
          </button>
        ))}
      </div>
      <Notice tone="purple" icon={<Lock size={18} />}>
        Тест 18+ доступен только пользователям старше 18 лет.
      </Notice>
    </div>
  );
}

function ProfileScreen({ busy, onSubmit }: { busy: boolean; onSubmit: (data: { displayName: string; gender: string; age: number }) => void }) {
  const [displayName, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState(18);
  const valid = displayName.trim().length >= 2 && Boolean(gender) && age >= 14 && age <= 99;

  return (
    <Card className="formCard">
      <SectionIntro title="Создайте профиль" text="Эти данные нужны, чтобы точнее адаптировать вопросы и отчёт для вашей пары." />
      <InputField label="Имя или ник" value={displayName} onChange={setName} placeholder="Например, Маша" error={displayName && displayName.length < 2 ? "Минимум 2 символа" : ""} />
      <FieldGroup label="Пол">
        <RadioGroup
          options={[
            { label: "Женский", value: "female" },
            { label: "Мужской", value: "male" },
            { label: "Другой", value: "other" },
          ]}
          value={gender}
          onChange={setGender}
        />
      </FieldGroup>
      <InputField label="Возраст" type="number" min={14} max={99} value={String(age)} onChange={(value) => setAge(Number(value))} />
      <Button loading={busy} disabled={!valid} onClick={() => onSubmit({ displayName: displayName.trim(), gender, age })}>
        Сохранить
      </Button>
    </Card>
  );
}

function PairScreen({
  pair,
  members,
  invite,
  busy,
  onSubmit,
}: {
  pair?: Pair | null;
  members: Member[];
  invite: string;
  busy: boolean;
  onSubmit: (data: { name?: string; mode?: "join"; inviteCode?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(invite);
  const [joinOpen, setJoinOpen] = useState(Boolean(invite));
  const share = pair && typeof location !== "undefined" ? `${location.origin}/?invite=${pair.inviteCode}` : "";

  if (pair) {
    const botInvite = `https://t.me/${botUsername}?start=${pair.inviteCode}`;
    return (
      <div className="screenStack inviteScreen">
        <DecorativeArt kind="invite" />
        <SectionIntro title="Пригласите партнёра" text="Пока второй участник не присоединится, тесты и результаты будут недоступны." />
        <div className="inviteCode" aria-label={`Код приглашения ${pair.inviteCode}`}>
          <span>{formatInviteCode(pair.inviteCode)}</span>
          <IconButton label="Скопировать код" onClick={() => navigator.clipboard.writeText(pair.inviteCode)}>
            <Copy size={18} />
          </IconButton>
        </div>
        <Button icon={<Copy size={18} />} onClick={() => navigator.clipboard.writeText(botInvite)}>
          Скопировать ссылку
        </Button>
        <Button asLink href={botInvite} variant="secondary" icon={<Send size={18} />}>
          Отправить ссылку в Telegram
        </Button>
        <div className="shareRow" aria-label="Способы поделиться">
          <ShareButton label="Telegram" icon={<Send size={20} />} href={botInvite} />
          <ShareButton label="WhatsApp" icon={<MessageCircle size={20} />} href={`https://wa.me/?text=${encodeURIComponent(share)}`} />
          <ShareButton label="Ещё" icon={<Copy size={20} />} onClick={() => share && navigator.clipboard.writeText(share)} />
        </div>
        <Notice tone={members.length < 2 ? "purple" : "success"} icon={<Shield size={18} />}>
          {members.length < 2 ? "Ожидаем партнёра. Как только он присоединится, вы оба получите сообщение в боте." : "Пара подтверждена. Функционал доступен."}
        </Notice>
      </div>
    );
  }

  return (
    <Card className="formCard">
      <SectionIntro title="Создайте пару" text="Создайте новую пару и отправьте партнёру код или ссылку. Если партнёр уже создал пару, присоединитесь по invite-коду." />
      <InputField label="Название пары" value={name} onChange={setName} placeholder="Например, Команда Луна" />
      <Button loading={busy} disabled={name.trim().length < 2} onClick={() => onSubmit({ name: name.trim() })}>
        Создать пару
      </Button>
      <Button variant="ghost" onClick={() => setJoinOpen((value) => !value)}>
        Присоединиться к уже созданной паре
      </Button>
      {joinOpen && (
        <>
          <Divider>или</Divider>
          <InputField label="Инвайт-код" value={formatInviteCode(code)} onChange={(value) => setCode(value.toUpperCase())} placeholder="AB2 - C1H" maxLength={10} />
          <Button variant="secondary" loading={busy} disabled={code.replace(/[^A-Z0-9]/gi, "").length < 6} onClick={() => onSubmit({ mode: "join", inviteCode: code })}>
            Вступить по коду
          </Button>
        </>
      )}
    </Card>
  );
}

function QuestionScreen({ index, total, onAnswer, disabled }: { index: number; total: number; onAnswer: (value: unknown) => void; disabled: boolean }) {
  const question = questions[index];
  const [value, setValue] = useState<unknown>(question.type === "multi" ? [] : question.type === "text" ? "" : 8);
  const multiValue = Array.isArray(value) ? value : [];

  return (
    <Card className="questionCard">
      <div className="questionMeta">
        <Badge tone="purple">{question.type === "scale" ? "Шкала 1-10" : categories[question.category]}</Badge>
        <span>{index + 1}/{total}</span>
      </div>
      <ProgressBar value={Math.round(((index + 1) / total) * 100)} />
      <h2>{question.title}</h2>

      {question.type === "scale" && <SegmentedControl value={Number(value)} onChange={setValue} count={10} />}
      {question.type === "slider" && <RangeSlider value={Number(value)} onChange={setValue} left={question.leftLabel || "Он"} right={question.rightLabel || "Она"} />}
      {question.type === "text" && <TextArea label="Ответ" value={String(value)} onChange={setValue} placeholder="Напишите здесь..." maxLength={500} />}
      {question.type === "single" && <RadioGroup options={question.options || []} value={String(value)} onChange={setValue} />}
      {question.type === "multi" && (
        <CheckboxGrid options={question.options || []} value={multiValue} onChange={setValue} />
      )}

      <Button disabled={disabled} loading={disabled} onClick={() => onAnswer(value)}>
        Ответить
      </Button>
    </Card>
  );
}

function ResultScreen({
  report,
  mineReady,
  partnerReady,
  unlocked,
  sessionId,
  onUnlock,
}: {
  report?: Report | null;
  mineReady: boolean;
  partnerReady: boolean;
  unlocked?: boolean;
  sessionId?: string;
  onUnlock: (sessionId: string) => void;
}) {
  if (!report) {
    return (
      <Card className="emptyState">
        <DecorativeArt kind="waiting" />
        <SectionIntro
          title="Ожидаем завершения"
          text={mineReady ? "Ваши ответы сохранены. Осталось дождаться партнёра." : "Пройдите тест, чтобы открыть результат."}
        />
        <Notice tone={partnerReady ? "success" : "warning"} icon={<Shield size={18} />}>
          {partnerReady ? "Партнёр уже готов." : "Ответы партнёра скрыты до завершения теста."}
        </Notice>
      </Card>
    );
  }

  return (
    <div className="screenStack resultScreen">
      <Card className="scoreCard">
        <h2>Ваша совместимость</h2>
        <div className="heartScore" aria-label={`Совместимость ${report.compatibility}%`}>
          <Heart size={138} />
          <strong>{report.compatibility}%</strong>
        </div>
        <h3>{report.title}</h3>
        <DecorativeArt kind="result-avatars" />
      </Card>

      <Card>
        <h2 className="cardTitle">Ключевые показатели</h2>
        <div className="indicatorList">
          {report.indicators?.map((item) => (
            <div className="indicator" key={item.key}>
              <span>{item.label}</span>
              <b>{item.value}%</b>
              <ProgressBar value={item.value} tone={item.key === "conflict" ? "coral" : "purple"} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="summaryCard">
        <h2>Главный вывод</h2>
        <p>{report.freeSummary}</p>
      </Card>

      {unlocked ? (
        <Card className="fullReport">
          <h2>Полный отчёт</h2>
          <p>{report.fullSummary}</p>
          <div className="recommendationList">
            {report.recommendations?.map((item) => (
              <Notice tone="purple" icon={<Check size={16} />} key={item}>
                {item}
              </Notice>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="paywallCard">
          <h2>Откройте полный отчёт</h2>
          <ul>
            {["Полный анализ всех категорий", "Все совпадения и расхождения", "Что партнёр думает о вас", "Персональные рекомендации"].map((item) => (
              <li key={item}><Check size={16} /> {item}</li>
            ))}
          </ul>
          <Button variant="secondary" disabled={!sessionId} onClick={() => sessionId && onUnlock(sessionId)} icon={<Lock size={18} />}>
            {reportPriceRub} ₽
          </Button>
        </Card>
      )}
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  disabled,
  loading,
  icon,
  onClick,
  asLink,
  href,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  asLink?: boolean;
  href?: string;
}) {
  const className = `uiAction uiAction-${variant}${loading ? " isLoading" : ""}`;
  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </>
  );

  if (asLink && href) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <button className={className} disabled={disabled || loading} onClick={onClick}>
      {content}
    </button>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="iconAction" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`surfaceCard ${className}`}>{children}</section>;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  min,
  max,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  min?: number;
  max?: number;
  maxLength?: number;
}) {
  const id = `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type={type} value={value} min={min} max={max} maxLength={maxLength} placeholder={placeholder} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
      {error && <em>{error}</em>}
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  const id = `textarea-${label}`;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
      {maxLength && <small>{value.length}/{maxLength}</small>}
    </label>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fieldGroup">
      <span>{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl({ value, onChange, count }: { value: number; onChange: (value: number) => void; count: number }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Шкала ответа">
      {Array.from({ length: count }, (_, index) => {
        const next = index + 1;
        return (
          <button key={next} className={value === next ? "isSelected" : ""} role="radio" aria-checked={value === next} onClick={() => onChange(next)}>
            {next}
          </button>
        );
      })}
    </div>
  );
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: Array<string | { label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="chipGrid" role="radiogroup">
      {options.map((option) => {
        const item = typeof option === "string" ? { label: option, value: option } : option;
        return (
        <button className={value === item.value ? "isSelected" : ""} role="radio" aria-checked={value === item.value} key={item.value} onClick={() => onChange(item.value)}>
          {item.label}
          {value === item.value && <Check size={16} />}
        </button>
        );
      })}
    </div>
  );
}

function CheckboxGrid({ options, value, onChange }: { options: string[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="optionTiles">
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button key={option} className={selected ? "isSelected" : ""} role="checkbox" aria-checked={selected} onClick={() => onChange(selected ? value.filter((item) => item !== option) : [...value, option])}>
            <Gift size={20} />
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}

function RangeSlider({ value, onChange, left, right }: { value: number; onChange: (value: number) => void; left: string; right: string }) {
  return (
    <div className="rangeControl">
      <input aria-label="Ползунок ответа" type="range" min={1} max={10} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <div>
        <span>{left}</span>
        <span>Одинаково</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "purple" }: { value: number; tone?: "purple" | "coral" }) {
  return (
    <span className={`progressBar progress-${tone}`} aria-label={`Прогресс ${value}%`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

function Badge({ children, tone = "pink" }: { children: React.ReactNode; tone?: "pink" | "purple" | "coral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Notice({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone: "purple" | "success" | "warning" | "danger" }) {
  return (
    <div className={`notice notice-${tone}`}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

function Toast({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" | "danger" }) {
  return (
    <div className={`toast toast-${tone}`} role="status">
      {tone === "success" ? <Check size={16} /> : <Shield size={16} />}
      <span>{children}</span>
    </div>
  );
}

function ShareButton({ label, icon, href, onClick }: { label: string; icon: React.ReactNode; href?: string; onClick?: () => void }) {
  const content = (
    <>
      <span>{icon}</span>
      <small>{label}</small>
    </>
  );
  if (href) {
    return (
      <a className="shareButton" href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }
  return (
    <button className="shareButton" onClick={onClick}>
      {content}
    </button>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="featureItem">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="sectionIntro">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return <div className="divider"><span>{children}</span></div>;
}

function DecorativeArt({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    couple: "💑",
    "couple-small": "💞",
    date: "💜",
    hot: "🔥",
    telegram: "💌",
    invite: "💜",
    waiting: "⏳",
    "result-avatars": "💕",
  };
  return (
    <div className={`art art-${kind}`} aria-hidden="true">
      <span>{map[kind] || "💕"}</span>
    </div>
  );
}
