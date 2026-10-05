'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Braces, ChevronRight, CircleHelp, Code2, Layers3, Pause, Play, RotateCcw, Shuffle, SkipBack, SkipForward, Sparkles } from 'lucide-react';

type SortKind = 'bubble' | 'selection' | 'insertion';
type Structure = 'array' | 'stack' | 'queue';
type Frame = { values: number[]; active: number[]; sorted: number[]; message: string; line: number };

const samples: Record<SortKind, string> = {
  bubble: `const data = [42, 18, 35, 9, 27, 14];

for (let i = 0; i < data.length; i++) {
  for (let j = 0; j < data.length - i - 1; j++) {
    if (data[j] > data[j + 1]) {
      [data[j], data[j + 1]] = [data[j + 1], data[j]];
    }
  }
}`,
  selection: `const data = [42, 18, 35, 9, 27, 14];

for (let i = 0; i < data.length; i++) {
  let min = i;
  for (let j = i + 1; j < data.length; j++) {
    if (data[j] < data[min]) min = j;
  }
  [data[i], data[min]] = [data[min], data[i]];
}`,
  insertion: `const data = [42, 18, 35, 9, 27, 14];

for (let i = 1; i < data.length; i++) {
  const key = data[i];
  let j = i - 1;
  while (j >= 0 && data[j] > key) {
    data[j + 1] = data[j--];
  }
  data[j + 1] = key;
}`,
};

const labels: Record<SortKind, string> = { bubble: 'バブルソート', selection: '選択ソート', insertion: '挿入ソート' };

function makeFrames(input: number[], kind: SortKind): Frame[] {
  const a = [...input];
  const frames: Frame[] = [{ values: [...a], active: [], sorted: [], message: '実行準備ができました', line: 1 }];
  if (kind === 'bubble') {
    for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length - i - 1; j++) {
      frames.push({ values: [...a], active: [j, j + 1], sorted: Array.from({ length: i }, (_, k) => a.length - 1 - k), message: `${a[j]} と ${a[j + 1]} を比較`, line: 5 });
      if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; frames.push({ values: [...a], active: [j, j + 1], sorted: Array.from({ length: i }, (_, k) => a.length - 1 - k), message: '左の値が大きいので交換', line: 6 }); }
    }
  } else if (kind === 'selection') {
    for (let i = 0; i < a.length; i++) {
      let min = i;
      for (let j = i + 1; j < a.length; j++) { frames.push({ values: [...a], active: [min, j], sorted: Array.from({ length: i }, (_, k) => k), message: `最小値候補 ${a[min]} と ${a[j]} を比較`, line: 6 }); if (a[j] < a[min]) min = j; }
      [a[i], a[min]] = [a[min], a[i]]; frames.push({ values: [...a], active: [i, min], sorted: Array.from({ length: i + 1 }, (_, k) => k), message: `${a[i]} の位置を確定`, line: 8 });
    }
  } else {
    for (let i = 1; i < a.length; i++) {
      const key = a[i]; let j = i - 1; frames.push({ values: [...a], active: [i], sorted: [], message: `${key} を挿入する位置を探します`, line: 4 });
      while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; frames.push({ values: [...a], active: [j, j + 1], sorted: [], message: `${a[j]} を右へ移動`, line: 7 }); j--; }
      a[j + 1] = key; frames.push({ values: [...a], active: [j + 1], sorted: Array.from({ length: i + 1 }, (_, k) => k), message: `${key} をここに挿入`, line: 9 });
    }
  }
  frames.push({ values: [...a], active: [], sorted: a.map((_, i) => i), message: 'ソートが完了しました！', line: 0 });
  return frames;
}

function parseValues(code: string) {
  const match = code.match(/\[([\d\s,.-]+)\]/); if (!match) return null;
  const values = match[1].split(',').map(Number).filter(Number.isFinite).slice(0, 10);
  return values.length >= 2 ? values : null;
}

export default function Home() {
  const [kind, setKind] = useState<SortKind>('bubble'); const [structure, setStructure] = useState<Structure>('array');
  const [code, setCode] = useState(samples.bubble); const [frames, setFrames] = useState(() => makeFrames([42, 18, 35, 9, 27, 14], 'bubble'));
  const [step, setStep] = useState(0); const [playing, setPlaying] = useState(false); const [speed, setSpeed] = useState(700); const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null); const frame = frames[step]; const max = Math.max(...frame.values, 1);
  useEffect(() => { if (timer.current) clearInterval(timer.current); if (playing) timer.current = setInterval(() => setStep((s) => { if (s >= frames.length - 1) { setPlaying(false); return s; } return s + 1; }), speed); return () => { if (timer.current) clearInterval(timer.current); }; }, [playing, speed, frames.length]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'start_sort_visualization', title: 'ソートを可視化',
      description: '指定した数値配列とアルゴリズムで、画面上のソートアニメーションを開始します。',
      inputSchema: { type: 'object', properties: { values: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 10 }, algorithm: { type: 'string', enum: ['bubble', 'selection', 'insertion'] } }, required: ['values', 'algorithm'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const data = input as { values?: number[]; algorithm?: SortKind };
        if (!Array.isArray(data.values) || data.values.length < 2 || data.values.length > 10 || !data.values.every(Number.isFinite) || !data.algorithm || !(data.algorithm in samples)) throw new Error('2〜10個の数値と有効なアルゴリズムを指定してください。');
        setKind(data.algorithm); setCode(samples[data.algorithm].replace(/\[[\d\s,.-]+\]/, `[${data.values.join(', ')}]`)); setFrames(makeFrames(data.values, data.algorithm)); setStep(0); setStructure('array'); setPlaying(true); setError('');
        return { status: 'started', algorithm: data.algorithm, values: data.values };
      }
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);
  const complexity = useMemo(() => ({ bubble: ['O(n²)', 'O(1)'], selection: ['O(n²)', 'O(1)'], insertion: ['O(n²)', 'O(1)'] }[kind]), [kind]);
  function chooseSort(next: SortKind) { setKind(next); setCode(samples[next]); setStep(0); setPlaying(false); setError(''); setFrames(makeFrames([42, 18, 35, 9, 27, 14], next)); }
  function run() { const values = parseValues(code); if (!values) { setError('コード内に、2個以上の数値を持つ配列を入力してください。'); return; } setFrames(makeFrames(values, kind)); setStep(0); setPlaying(true); setError(''); setStructure('array'); }
  function randomize() { const values = Array.from({ length: 7 }, () => Math.floor(Math.random() * 46) + 5); setCode(code.replace(/\[[\d\s,.-]+\]/, `[${values.join(', ')}]`)); setFrames(makeFrames(values, kind)); setStep(0); setPlaying(false); }
  return <main className="min-h-screen bg-[#f7f8f5] text-[#17231f]">
    <header className="border-b border-[#dfe5df] bg-white/90 px-5 py-3 backdrop-blur md:px-8"><div className="mx-auto flex max-w-[1500px] items-center justify-between"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#20c486] text-white"><Braces size={20}/></div><div><p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#20a978]">Algorithm Lab</p><h1 className="text-lg font-bold leading-tight">うごくアルゴリズム</h1></div></div><div className="hidden items-center gap-2 text-xs text-[#66736e] sm:flex"><Sparkles size={15} className="text-[#ef9f35]"/> コードの動きを、目で理解する</div><button className="grid size-9 place-items-center rounded-full border border-[#dfe5df] bg-white" aria-label="ヘルプ"><CircleHelp size={17}/></button></div></header>
    <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-8"><nav className="mb-4 flex items-center gap-2 overflow-x-auto" aria-label="データ構造">{([['array','配列'],['stack','スタック'],['queue','キュー']] as const).map(([id,name]) => <button key={id} onClick={() => setStructure(id)} className={`structure-tab ${structure===id?'active':''}`}><Layers3 size={15}/>{name}</button>)}<span className="ml-auto hidden text-xs text-[#78847f] md:block">現在のレッスン　<span className="font-bold text-[#24352f]">01 / ソートの基本</span></span></nav>
      {structure === 'array' ? <section className="grid gap-4 lg:grid-cols-[minmax(360px,.82fr)_minmax(500px,1.18fr)]"><div className="panel overflow-hidden"><div className="panel-head"><div><span className="eyebrow">CODE EDITOR</span><h2><Code2 size={17}/> JavaScript</h2></div><select aria-label="アルゴリズム" value={kind} onChange={(e)=>chooseSort(e.target.value as SortKind)}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div><div className="editor-wrap"><div className="line-numbers" aria-hidden="true">{code.split('\n').map((_,i)=><span key={i} className={frame.line===i+1?'current':''}>{i+1}</span>)}</div><textarea value={code} onChange={(e)=>setCode(e.target.value)} spellCheck={false} aria-label="コードエディター" /></div>{error && <p className="error">{error}</p>}<div className="editor-actions"><button className="secondary-btn" onClick={randomize}><Shuffle size={15}/> ランダム</button><button className="run-btn" onClick={run}><Play size={16} fill="currentColor"/> 実行する</button></div></div>
        <div className="panel viz-panel"><div className="panel-head"><div><span className="eyebrow">VISUALIZER</span><h2>{labels[kind]}</h2></div><div className="complexity"><span>時間 <b>{complexity[0]}</b></span><span>空間 <b>{complexity[1]}</b></span></div></div><div className="legend"><span><i className="dot bg-[#20c486]"/>確定</span><span><i className="dot bg-[#ffb24a]"/>比較中</span><span><i className="dot bg-[#dfe7e2]"/>未処理</span></div><div className="bars" aria-label="配列のアニメーション">{frame.values.map((value,i)=>{const active=frame.active.includes(i), done=frame.sorted.includes(i); return <div key={`${i}-${value}`} className="bar-slot"><div className={`bar ${active?'active':done?'done':''}`} style={{height:`${Math.max(22,(value/max)*100)}%`}}><span>{value}</span></div><small>{i}</small></div>})}</div><div className="status"><span className="status-icon"><ChevronRight size={17}/></span><div><small>STEP {step} / {frames.length-1}</small><p>{frame.message}</p></div></div><div className="timeline"><div className="progress"><span style={{width:`${(step/(frames.length-1))*100}%`}}/></div><div className="controls"><button onClick={()=>setStep(0)} aria-label="最初へ"><SkipBack size={17}/></button><button className="play" onClick={()=>setPlaying(!playing)} aria-label={playing?'一時停止':'再生'}>{playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button><button onClick={()=>setStep(Math.min(frames.length-1,step+1))} aria-label="次へ"><SkipForward size={17}/></button><select value={speed} onChange={(e)=>setSpeed(Number(e.target.value))} aria-label="再生速度"><option value="1100">0.5×</option><option value="700">1×</option><option value="360">2×</option></select><button onClick={()=>{setStep(0);setPlaying(false)}} aria-label="リセット"><RotateCcw size={16}/></button></div></div></div></section> : <StructureDemo type={structure}/>} 
      <section className="learning-note"><div className="note-index">01</div><div><span className="eyebrow">POINT</span><h3>{labels[kind]}の動きを追ってみよう</h3><p>{kind==='bubble'?'隣り合う2つを比べ、大きい値を右へ送ります。1周するたびに最大値の位置が確定します。':kind==='selection'?'未整列の範囲から最小値を探し、先頭と交換します。確定エリアが左から広がります。':'値をひとつ取り出し、左側の整列済みエリアの正しい位置へ差し込みます。'}</p></div></section>
    </div></main>;
}

function StructureDemo({type}:{type:'stack'|'queue'}) {
  const [items,setItems]=useState([12,28,7]); const [next,setNext]=useState(35);
  const add=()=>{setItems([...items,next]);setNext(Math.floor(Math.random()*90)+10)}; const remove=()=>setItems(type==='stack'?items.slice(0,-1):items.slice(1));
  return <section className="panel structure-demo"><div><span className="eyebrow">DATA STRUCTURE</span><h2 className="mt-1 text-xl font-bold">{type==='stack'?'スタック — LIFO':'キュー — FIFO'}</h2><p>{type==='stack'?'最後に入れたデータから取り出す「後入れ先出し」の構造です。':'最初に入れたデータから取り出す「先入れ先出し」の構造です。'}</p><div className="demo-actions"><button className="run-btn" onClick={add}>{type==='stack'?'push':'enqueue'}({next})</button><button className="secondary-btn" onClick={remove} disabled={!items.length}>{type==='stack'?'pop':'dequeue'}()</button></div></div><div className={`data-boxes ${type}`}><span className="flow-label">{type==='stack'?'TOP':'OUT'}</span>{items.map((v,i)=><div className="data-item" key={`${v}-${i}`}>{v}</div>)}{!items.length&&<p className="empty">空です</p>}<span className="flow-label">{type==='queue'?'IN':''}</span></div></section>;
}
