"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  user: { id: string; displayName?: string | null; telegramName?: string | null; firstName?: string | null; photoUrl?: string | null; gender?: string | null; age?: number | null } | null;
  pair?: Pair | null;
  session?: Session | null;
} | null;

type Screen = "home" | "tests" | "welcome" | "profile" | "pair" | "test" | "result";
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
  const avatarLabel = userLabel || "55 Р’РѕРїСЂРѕСЃРѕРІ";

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
      if (screen !== "welcome" && screen !== "profile") nextScreen = "welcome";
    } else if (!pair || members.length < 2) {
      nextScreen = "pair";
    } else if (screen === "welcome" || screen === "profile" || screen === "pair") {
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
        }
      } catch (error) {
        if (!cancelled) {
          setToast({ tone: "danger", text: error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ РІРѕР№С‚Рё С‡РµСЂРµР· Mini App" });
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
      setToast({ tone: "danger", text: error instanceof Error ? error.message : "Р§С‚Рѕ-С‚Рѕ РїРѕС€Р»Рѕ РЅРµ С‚Р°Рє" });
    } finally {
      setBusy(false);
    }
  }

  async function startTest() {
    if (!user) {
      setToast({ tone: "warning", text: "РћС‚РєСЂРѕР№С‚Рµ РїСЂРёР»РѕР¶РµРЅРёРµ РІРЅСѓС‚СЂРё Telegram, С‡С‚РѕР±С‹ РїСЂРѕРґРѕР»Р¶РёС‚СЊ" });
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
    }, "РћС‚РІРµС‚ СЃРѕС…СЂР°РЅС‘РЅ");
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
      <section className="appFrame" aria-label="55 Р’РѕРїСЂРѕСЃРѕРІ application">
        <AppHeader
          screen={screen}
          userName={userLabel}
          avatarUrl={user?.photoUrl || ""}
          avatarLabel={avatarLabel}
        />

        {toast && <Toast tone={toast.tone}>{toast.text}</Toast>}

        {screen === "home" && <HomeScreen busy={busy} onStart={startTest} onTests={() => navigate("tests")} />}
        {screen === "tests" && <TestsScreen onStart={startTest} />}
        {screen === "welcome" && <WelcomeScreen onContinue={() => navigate("profile")} />}
        {screen === "profile" && (
          <ProfileScreen
            busy={busy}
            onSubmit={(data) =>
              run(async () => {
                await api("/api/profile", data);
                setScreen("pair");
              }, "РџСЂРѕС„РёР»СЊ СЃРѕС…СЂР°РЅС‘РЅ")
            }
          />
        )}
        {screen === "pair" && (
          <PairScreen
            pair={pair}
            members={members}
            invite={inviteFromUrl || ""}
            busy={busy}
            onSubmit={(data) => run(() => api("/api/pair", data), data.mode === "join" ? "Р’С‹ РІСЃС‚СѓРїРёР»Рё РІ РїР°СЂСѓ" : "РџР°СЂР° СЃРѕР·РґР°РЅР°")}
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
            onUnlock={(sessionId) => run(() => api("/api/payment/mock", { sessionId }), "РџРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚ РѕС‚РєСЂС‹С‚")}
          />
        )}
      </section>
    </main>
  );
}

function AppHeader({
  screen,
  userName,
  avatarUrl,
  avatarLabel,
}: {
  screen: Screen;
  userName: string;
  avatarUrl: string;
  avatarLabel: string;
}) {
  const title = screen === "home" ? "55 Вопросов" : screen === "tests" ? "Выберите тест" : screen === "pair" ? "Пригласите партнёра" : screen === "result" ? "Ваш результат" : "55 Вопросов";

  return (
    <header className="appHeader">
      <div className="headerLeft">
        <AvatarMark src={avatarUrl} label={avatarLabel} />
        <div>
          <p className="eyebrow">{userName || "55 Вопросов"}</p>
          <h1 className="headerTitle">{title}</h1>
        </div>
      </div>
    </header>
  );
}

function AvatarMark({ src, label }: { src: string; label: string }) {
  const fallback = label.trim().slice(0, 1).toUpperCase() || "5";
  return (
    <span className="avatarMark" aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : <span>{fallback}</span>}
    </span>
  );
}
function HomeScreen({ busy, onStart, onTests }: { busy: boolean; onStart: () => void; onTests: () => void }) {
  return (
    <div className="screenStack">
      <section className="heroPanel" aria-labelledby="home-title">
        <div className="heroCopy">
          <h2 id="home-title">
            РЈР·РЅР°Р№С‚Рµ РїСЂР°РІРґСѓ <span>Рѕ РІР°С€РёС… РѕС‚РЅРѕС€РµРЅРёСЏС…</span>
          </h2>
          <p>РџСЂРѕР№РґРёС‚Рµ С‚РµСЃС‚ РІРјРµСЃС‚Рµ СЃ РїР°СЂС‚РЅС‘СЂРѕРј Рё РїРѕР»СѓС‡РёС‚Рµ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹Р№ DeepSeek-Р°РЅР°Р»РёР· СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё.</p>
        </div>
        <DecorativeArt kind="couple" />
        <Card className="benefitCard">
          <Feature icon={<Heart size={20} />} title="3 СѓРЅРёРєР°Р»СЊРЅС‹С… С‚РµСЃС‚Р°" text="Р”Р»СЏ СЂР°Р·РЅС‹С… СЌС‚Р°РїРѕРІ РѕС‚РЅРѕС€РµРЅРёР№" />
          <Feature icon={<Brain size={20} />} title="AI-Р°РЅР°Р»РёР·" text="РљСЂР°С‚РєРёР№ СЂРµР·СѓР»СЊС‚Р°С‚ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ РїСЂРѕС…РѕР¶РґРµРЅРёСЏ" />
          <Feature icon={<Shield size={20} />} title="РљРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕ" text="РћС‚РІРµС‚С‹ СЃРєСЂС‹С‚С‹ РґРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ РѕР±РѕРёРјРё" />
        </Card>
        <Button loading={busy} onClick={onStart}>
          РЎРѕР·РґР°С‚СЊ РїР°СЂСѓ Рё РЅР°С‡Р°С‚СЊ С‚РµСЃС‚
        </Button>
        <Button variant="ghost" onClick={onTests}>
          РџРѕСЃРјРѕС‚СЂРµС‚СЊ РІСЃРµ С‚РµСЃС‚С‹
        </Button>
      </section>
    </div>
  );
}

function EnvironmentLoadingScreen() {
  return (
    <main className="appShell browserOnlyShell">
      <section className="appFrame" aria-label="РџСЂРѕРІРµСЂРєР° Telegram Mini App">
        <Card className="browserOnlyCard">
          <span className="brandMark browserOnlyIcon" aria-hidden="true">
            <Heart size={24} />
          </span>
          <SectionIntro title="55 Р’РѕРїСЂРѕСЃРѕРІ" text="Р—Р°РїСѓСЃРєР°РµРј РїСЂРёР»РѕР¶РµРЅРёРµ..." />
        </Card>
      </section>
    </main>
  );
}

function BrowserOnlyScreen() {
  return (
    <main className="appShell browserOnlyShell">
      <section className="appFrame" aria-label="55 Р’РѕРїСЂРѕСЃРѕРІ">
        <Card className="browserOnlyCard">
          <span className="brandMark browserOnlyIcon" aria-hidden="true">
            <Heart size={24} />
          </span>
          <SectionIntro
            title="55 Р’РѕРїСЂРѕСЃРѕРІ"
            text="РР·РІРёРЅРёС‚Рµ, РІ РґР°РЅРЅС‹Р№ РјРѕРјРµРЅС‚ СЃРµСЂРІРёСЃ В«55 Р’РѕРїСЂРѕСЃРѕРІВ» РЅРµ СЂР°Р±РѕС‚Р°РµС‚ С‡РµСЂРµР· РѕР±С‹С‡РЅС‹Р№ Р±СЂР°СѓР·РµСЂ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РѕС‚РєСЂРѕР№С‚Рµ РїСЂРёР»РѕР¶РµРЅРёРµ РІ Telegram."
          />
          <Button asLink href={`https://t.me/${botUsername}`} icon={<Send size={18} />}>
            РџРµСЂРµР№С‚Рё Рє Р±РѕС‚Сѓ
          </Button>
        </Card>
      </section>
    </main>
  );
}

function TestsScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="screenStack">
      <SectionIntro title="Р’С‹Р±РµСЂРёС‚Рµ С‚РµСЃС‚" text="Р’ РїРµСЂРІРѕР№ РІРµСЂСЃРёРё Р°РєС‚РёРІРµРЅ РѕСЃРЅРѕРІРЅРѕР№ С‚РµСЃС‚ РґР»СЏ РїР°СЂС‹. РћСЃС‚Р°Р»СЊРЅС‹Рµ СЃС†РµРЅР°СЂРёРё СѓР¶Рµ Р·Р°СЂРµР·РµСЂРІРёСЂРѕРІР°РЅС‹ РІ РёРЅС‚РµСЂС„РµР№СЃРµ." />
      <div className="testGrid">
        {tests.map((test, index) => (
          <button className={`testCard testTone${index}`} key={test.slug} disabled={!test.enabled} onClick={onStart}>
            <span className="testText">
              <strong>{test.title}</strong>
              <span>{test.subtitle}</span>
              <Badge tone={index === 0 ? "pink" : index === 1 ? "purple" : "coral"}>{test.questions} РІРѕРїСЂРѕСЃРѕРІ</Badge>
            </span>
            <DecorativeArt kind={index === 0 ? "couple-small" : index === 1 ? "date" : "hot"} />
          </button>
        ))}
      </div>
      <Notice tone="purple" icon={<Lock size={18} />}>
        РўРµСЃС‚ 18+ РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРј СЃС‚Р°СЂС€Рµ 18 Р»РµС‚.
      </Notice>
    </div>
  );
}

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <Card className="formCard welcomeCard">
      <span className="brandMark browserOnlyIcon" aria-hidden="true">
        <Heart size={24} />
      </span>
      <SectionIntro
        title="Р Р°РґС‹ РІР°СЃ РІРёРґРµС‚СЊ"
        text="Р”РѕР±СЂРѕ РїРѕР¶Р°Р»РѕРІР°С‚СЊ РІ РїСЂРёР»РѕР¶РµРЅРёРµ 55 Р’РѕРїСЂРѕСЃРѕРІ. Р—РґРµСЃСЊ РІС‹ СЃРјРѕР¶РµС‚Рµ РїСЂРѕР№С‚Рё С‚РµСЃС‚ РІРјРµСЃС‚Рµ СЃ РїР°СЂС‚РЅС‘СЂРѕРј Рё РїРѕР»СѓС‡РёС‚СЊ Р±РµСЂРµР¶РЅС‹Р№ AI-Р°РЅР°Р»РёР· РІР°С€РёС… РѕС‚РЅРѕС€РµРЅРёР№."
      />
      <Button onClick={onContinue}>РџСЂРѕРґРѕР»Р¶РёС‚СЊ</Button>
    </Card>
  );
}

function ProfileScreen({ busy, onSubmit }: { busy: boolean; onSubmit: (data: { displayName: string; gender: string; age: number }) => void }) {
  const [displayName, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState(18);
  const valid = displayName.trim().length >= 2 && Boolean(gender) && age >= 14 && age <= 99;

  return (
    <Card className="formCard">
      <SectionIntro title="Р”Р°РІР°Р№С‚Рµ Р·РЅР°РєРѕРјРёС‚СЊСЃСЏ" text="Р­С‚Рё РґР°РЅРЅС‹Рµ РЅСѓР¶РЅС‹ РЅР°Рј, С‡С‚РѕР±С‹ С‚РѕС‡РЅРµРµ Р°РґР°РїС‚РёСЂРѕРІР°С‚СЊ РІРѕРїСЂРѕСЃС‹ Рё РѕС‚С‡С‘С‚ РґР»СЏ РІР°С€РµР№ РїР°СЂС‹." />
      <InputField label="РРјСЏ РёР»Рё РЅРёРє" value={displayName} onChange={setName} placeholder="РќР°РїСЂРёРјРµСЂ, РњР°С€Р°" error={displayName && displayName.length < 2 ? "РњРёРЅРёРјСѓРј 2 СЃРёРјРІРѕР»Р°" : ""} />
      <FieldGroup label="РџРѕР»">
        <RadioGroup
          options={[
            { label: "РњСѓР¶СЃРєРѕР№", value: "male" },
            { label: "Р–РµРЅСЃРєРёР№", value: "female" },
          ]}
          value={gender}
          onChange={setGender}
        />
      </FieldGroup>
      <AgeSlider value={age} onChange={setAge} />
      <Button loading={busy} disabled={!valid} onClick={() => onSubmit({ displayName: displayName.trim(), gender, age })}>
        РЎРѕС…СЂР°РЅРёС‚СЊ
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
        <SectionIntro title="РџСЂРёРіР»Р°СЃРёС‚Рµ РїР°СЂС‚РЅС‘СЂР°" text="РџРѕРєР° РІС‚РѕСЂРѕР№ СѓС‡Р°СЃС‚РЅРёРє РЅРµ РїСЂРёСЃРѕРµРґРёРЅРёС‚СЃСЏ, С‚РµСЃС‚С‹ Рё СЂРµР·СѓР»СЊС‚Р°С‚С‹ Р±СѓРґСѓС‚ РЅРµРґРѕСЃС‚СѓРїРЅС‹." />
        <div className="inviteCode" aria-label={`РљРѕРґ РїСЂРёРіР»Р°С€РµРЅРёСЏ ${pair.inviteCode}`}>
          <span>{formatInviteCode(pair.inviteCode)}</span>
          <IconButton label="РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РєРѕРґ" onClick={() => navigator.clipboard.writeText(pair.inviteCode)}>
            <Copy size={18} />
          </IconButton>
        </div>
        <Button icon={<Copy size={18} />} onClick={() => navigator.clipboard.writeText(botInvite)}>
          РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ
        </Button>
        <Button asLink href={botInvite} variant="secondary" icon={<Send size={18} />}>
          РћС‚РїСЂР°РІРёС‚СЊ СЃСЃС‹Р»РєСѓ РІ Telegram
        </Button>
        <div className="shareRow" aria-label="РЎРїРѕСЃРѕР±С‹ РїРѕРґРµР»РёС‚СЊСЃСЏ">
          <ShareButton label="Telegram" icon={<Send size={20} />} href={botInvite} />
          <ShareButton label="WhatsApp" icon={<MessageCircle size={20} />} href={`https://wa.me/?text=${encodeURIComponent(share)}`} />
          <ShareButton label="Р•С‰С‘" icon={<Copy size={20} />} onClick={() => share && navigator.clipboard.writeText(share)} />
        </div>
        <Notice tone={members.length < 2 ? "purple" : "success"} icon={<Shield size={18} />}>
          {members.length < 2 ? "РћР¶РёРґР°РµРј РїР°СЂС‚РЅС‘СЂР°. РљР°Рє С‚РѕР»СЊРєРѕ РѕРЅ РїСЂРёСЃРѕРµРґРёРЅРёС‚СЃСЏ, РІС‹ РѕР±Р° РїРѕР»СѓС‡РёС‚Рµ СЃРѕРѕР±С‰РµРЅРёРµ РІ Р±РѕС‚Рµ." : "РџР°СЂР° РїРѕРґС‚РІРµСЂР¶РґРµРЅР°. Р¤СѓРЅРєС†РёРѕРЅР°Р» РґРѕСЃС‚СѓРїРµРЅ."}
        </Notice>
      </div>
    );
  }

  return (
    <Card className="formCard">
      <SectionIntro title="РЎРѕР·РґР°Р№С‚Рµ РїР°СЂСѓ" text="РЎРѕР·РґР°Р№С‚Рµ РЅРѕРІСѓСЋ РїР°СЂСѓ Рё РѕС‚РїСЂР°РІСЊС‚Рµ РїР°СЂС‚РЅС‘СЂСѓ РєРѕРґ РёР»Рё СЃСЃС‹Р»РєСѓ. Р•СЃР»Рё РїР°СЂС‚РЅС‘СЂ СѓР¶Рµ СЃРѕР·РґР°Р» РїР°СЂСѓ, РїСЂРёСЃРѕРµРґРёРЅРёС‚РµСЃСЊ РїРѕ invite-РєРѕРґСѓ." />
      <InputField label="РќР°Р·РІР°РЅРёРµ РїР°СЂС‹" value={name} onChange={setName} placeholder="РќР°РїСЂРёРјРµСЂ, РљРѕРјР°РЅРґР° Р›СѓРЅР°" />
      <Button loading={busy} disabled={name.trim().length < 2} onClick={() => onSubmit({ name: name.trim() })}>
        РЎРѕР·РґР°С‚СЊ РїР°СЂСѓ
      </Button>
      <Button variant="ghost" onClick={() => setJoinOpen((value) => !value)}>
        РџСЂРёСЃРѕРµРґРёРЅРёС‚СЊСЃСЏ Рє СѓР¶Рµ СЃРѕР·РґР°РЅРЅРѕР№ РїР°СЂРµ
      </Button>
      {joinOpen && (
        <>
          <Divider>РёР»Рё</Divider>
          <InputField label="РРЅРІР°Р№С‚-РєРѕРґ" value={formatInviteCode(code)} onChange={(value) => setCode(value.toUpperCase())} placeholder="AB2 - C1H" maxLength={10} />
          <Button variant="secondary" loading={busy} disabled={code.replace(/[^A-Z0-9]/gi, "").length < 6} onClick={() => onSubmit({ mode: "join", inviteCode: code })}>
            Р’СЃС‚СѓРїРёС‚СЊ РїРѕ РєРѕРґСѓ
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
        <Badge tone="purple">{question.type === "scale" ? "РЁРєР°Р»Р° 1-10" : categories[question.category]}</Badge>
        <span>{index + 1}/{total}</span>
      </div>
      <ProgressBar value={Math.round(((index + 1) / total) * 100)} />
      <h2>{question.title}</h2>

      {question.type === "scale" && <SegmentedControl value={Number(value)} onChange={setValue} count={10} />}
      {question.type === "slider" && <RangeSlider value={Number(value)} onChange={setValue} left={question.leftLabel || "РћРЅ"} right={question.rightLabel || "РћРЅР°"} />}
      {question.type === "text" && <TextArea label="РћС‚РІРµС‚" value={String(value)} onChange={setValue} placeholder="РќР°РїРёС€РёС‚Рµ Р·РґРµСЃСЊ..." maxLength={500} />}
      {question.type === "single" && <RadioGroup options={question.options || []} value={String(value)} onChange={setValue} />}
      {question.type === "multi" && (
        <CheckboxGrid options={question.options || []} value={multiValue} onChange={setValue} />
      )}

      <Button disabled={disabled} loading={disabled} onClick={() => onAnswer(value)}>
        РћС‚РІРµС‚РёС‚СЊ
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
          title="РћР¶РёРґР°РµРј Р·Р°РІРµСЂС€РµРЅРёСЏ"
          text={mineReady ? "Р’Р°С€Рё РѕС‚РІРµС‚С‹ СЃРѕС…СЂР°РЅРµРЅС‹. РћСЃС‚Р°Р»РѕСЃСЊ РґРѕР¶РґР°С‚СЊСЃСЏ РїР°СЂС‚РЅС‘СЂР°." : "РџСЂРѕР№РґРёС‚Рµ С‚РµСЃС‚, С‡С‚РѕР±С‹ РѕС‚РєСЂС‹С‚СЊ СЂРµР·СѓР»СЊС‚Р°С‚."}
        />
        <Notice tone={partnerReady ? "success" : "warning"} icon={<Shield size={18} />}>
          {partnerReady ? "РџР°СЂС‚РЅС‘СЂ СѓР¶Рµ РіРѕС‚РѕРІ." : "РћС‚РІРµС‚С‹ РїР°СЂС‚РЅС‘СЂР° СЃРєСЂС‹С‚С‹ РґРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ С‚РµСЃС‚Р°."}
        </Notice>
      </Card>
    );
  }

  return (
    <div className="screenStack resultScreen">
      <Card className="scoreCard">
        <h2>Р’Р°С€Р° СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ</h2>
        <div className="heartScore" aria-label={`РЎРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ ${report.compatibility}%`}>
          <Heart size={138} />
          <strong>{report.compatibility}%</strong>
        </div>
        <h3>{report.title}</h3>
        <DecorativeArt kind="result-avatars" />
      </Card>

      <Card>
        <h2 className="cardTitle">РљР»СЋС‡РµРІС‹Рµ РїРѕРєР°Р·Р°С‚РµР»Рё</h2>
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
        <h2>Р“Р»Р°РІРЅС‹Р№ РІС‹РІРѕРґ</h2>
        <p>{report.freeSummary}</p>
      </Card>

      {unlocked ? (
        <Card className="fullReport">
          <h2>РџРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚</h2>
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
          <h2>РћС‚РєСЂРѕР№С‚Рµ РїРѕР»РЅС‹Р№ РѕС‚С‡С‘С‚</h2>
          <ul>
            {["РџРѕР»РЅС‹Р№ Р°РЅР°Р»РёР· РІСЃРµС… РєР°С‚РµРіРѕСЂРёР№", "Р’СЃРµ СЃРѕРІРїР°РґРµРЅРёСЏ Рё СЂР°СЃС…РѕР¶РґРµРЅРёСЏ", "Р§С‚Рѕ РїР°СЂС‚РЅС‘СЂ РґСѓРјР°РµС‚ Рѕ РІР°СЃ", "РџРµСЂСЃРѕРЅР°Р»СЊРЅС‹Рµ СЂРµРєРѕРјРµРЅРґР°С†РёРё"].map((item) => (
              <li key={item}><Check size={16} /> {item}</li>
            ))}
          </ul>
          <Button variant="secondary" disabled={!sessionId} onClick={() => sessionId && onUnlock(sessionId)} icon={<Lock size={18} />}>
            {reportPriceRub} в‚Ѕ
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
    <div className="segmented" role="radiogroup" aria-label="РЁРєР°Р»Р° РѕС‚РІРµС‚Р°">
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
      <input aria-label="РџРѕР»Р·СѓРЅРѕРє РѕС‚РІРµС‚Р°" type="range" min={1} max={10} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <div>
        <span>{left}</span>
        <span>РћРґРёРЅР°РєРѕРІРѕ</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function AgeSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="ageSlider">
      <div>
        <span>Р’РѕР·СЂР°СЃС‚</span>
        <strong>{value}</strong>
      </div>
      <input aria-label="Р’РѕР·СЂР°СЃС‚" type="range" min={14} max={99} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <div>
        <span>14</span>
        <span>99</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "purple" }: { value: number; tone?: "purple" | "coral" }) {
  return (
    <span className={`progressBar progress-${tone}`} aria-label={`РџСЂРѕРіСЂРµСЃСЃ ${value}%`}>
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
    couple: "рџ’‘",
    "couple-small": "рџ’ћ",
    date: "рџ’њ",
    hot: "рџ”Ґ",
    telegram: "рџ’Њ",
    invite: "рџ’њ",
    waiting: "вЏі",
    "result-avatars": "рџ’•",
  };
  return (
    <div className={`art art-${kind}`} aria-hidden="true">
      <span>{map[kind] || "рџ’•"}</span>
    </div>
  );
}
