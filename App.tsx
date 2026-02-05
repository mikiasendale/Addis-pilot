import React, { useState, useEffect, useRef } from 'react';
import { PDFReader } from './components/PDFReader';
import { Avatar } from './components/Avatar';
import { Dashboard } from './components/Dashboard';
import { generateExplanation, generateSpeech, generateQuiz } from './services/geminiService';
import { AppMode, ChatMessage, NavigationStep, GradeLevel, Subject, Language, QuizQuestion } from './types';
import { TRANSLATIONS } from './translations';
import { 
  Play, Mic, FileText, Upload, School, AlertCircle, 
  BookOpen, Calculator, Atom, Dna, Globe, ChevronLeft, Layers, Languages, Check, X,
  Brain, Send, Sparkles
} from 'lucide-react';

// --- INTEGRATION GUIDE ---
// 1. Place your PDF files in the 'public' folder.
// 2. Update the URLs below. Example: pdfUrl: "/textbooks/grade11_physics.pdf"
const SAMPLE_PDF_URL = "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"; 

const CURRICULUM: GradeLevel[] = [
  {
    id: '11',
    labelKey: 'grade_11',
    subjects: [
      { id: 'phy11', nameKey: 'physics', iconName: 'Atom', pdfUrl: SAMPLE_PDF_URL },
      { id: 'math11', nameKey: 'math', iconName: 'Calculator', pdfUrl: SAMPLE_PDF_URL },
      { id: 'bio11', nameKey: 'biology', iconName: 'Dna', pdfUrl: SAMPLE_PDF_URL },
      { id: 'chem11', nameKey: 'chemistry', iconName: 'FlaskConical', pdfUrl: SAMPLE_PDF_URL },
      { id: 'eng11', nameKey: 'english', iconName: 'BookOpen', pdfUrl: SAMPLE_PDF_URL },
    ]
  },
  {
    id: '12',
    labelKey: 'grade_12',
    subjects: [
      { id: 'phy12', nameKey: 'physics', iconName: 'Atom', pdfUrl: SAMPLE_PDF_URL },
      { id: 'math12', nameKey: 'math', iconName: 'Calculator', pdfUrl: SAMPLE_PDF_URL },
      { id: 'bio12', nameKey: 'biology', iconName: 'Dna', pdfUrl: SAMPLE_PDF_URL },
      { id: 'chem12', nameKey: 'chemistry', iconName: 'FlaskConical', pdfUrl: SAMPLE_PDF_URL },
      { id: 'eng12', nameKey: 'english', iconName: 'BookOpen', pdfUrl: SAMPLE_PDF_URL },
    ]
  }
];

const IconMap: Record<string, React.FC<any>> = {
  Atom: Atom,
  Calculator: Calculator,
  Dna: Dna,
  BookOpen: BookOpen,
  Globe: Globe,
  FlaskConical: Layers 
};

const fetchPdfWithCache = async (url: string): Promise<Blob> => {
  if (!('caches' in window)) {
    const response = await fetch(url);
    return response.blob();
  }
  const CACHE_NAME = 'addis-pilot-textbooks-v1';
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      console.log(`[Cache Hit] Loading ${url} from local storage.`);
      return cachedResponse.blob();
    }
    console.log(`[Network Fetch] Downloading ${url}...`);
    const networkResponse = await fetch(url);
    if (!networkResponse.ok) throw new Error("Network error");
    cache.put(url, networkResponse.clone());
    return networkResponse.blob();
  } catch (error) {
    console.error("Caching failed:", error);
    const response = await fetch(url);
    return response.blob();
  }
};

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.STUDENT);
  const [navStep, setNavStep] = useState<NavigationStep>('GRADE_SELECT');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [language, setLanguage] = useState<Language>('ENGLISH');
  const [file, setFile] = useState<File | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Ask Taytu Input State
  const [inputMessage, setInputMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizActive, setQuizActive] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyserState, setAnalyserState] = useState<AnalyserNode | null>(null);

  const t = (key: string) => TRANSLATIONS[language][key] || key;

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    const AudioContextPolyfill = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextPolyfill({ sampleRate: 24000 });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    setAnalyserState(analyser);
    return () => { ctx.close(); }
  }, []);

  // FIXED: Manual PCM Decoding for Gemini 2.5 TTS
  // NOTE: Browser's decodeAudioData fails on raw PCM. We must construct AudioBuffer manually.
  const playAudio = async (base64String: string) => {
    const ctx = audioContextRef.current;
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;

    try {
      // 1. Convert Base64 to Binary String
      const binaryString = atob(base64String);
      const len = binaryString.length;
      
      // 2. Create Uint8Array from binary string
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }

      // 3. Create Int16Array (Raw PCM data is 16-bit signed integer)
      // Ensure byte length is even
      const bufferLen = bytes.length % 2 === 0 ? bytes.length : bytes.length - 1;
      const int16Data = new Int16Array(bytes.buffer, 0, bufferLen / 2);

      // 4. Create AudioBuffer (Mono, 24kHz matches Gemini Output)
      const audioBuffer = ctx.createBuffer(1, int16Data.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      // 5. Convert Int16 to Float32 (-1.0 to 1.0) for Web Audio API
      for (let i = 0; i < int16Data.length; i++) {
          // Normalization: 32768 is the max amplitude for 16-bit audio
          channelData[i] = int16Data[i] / 32768.0;
      }

      setIsSpeaking(true);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (e) {
      console.error("Audio Playback Failed:", e);
      setIsSpeaking(false);
    }
  };

  const processAIResponse = async (text: string, context: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const explanation = await generateExplanation(text, context, language);
      const aiMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: explanation, timestamp: Date.now() };
      setChatHistory(prev => [...prev, aiMsg]);
      const audioBase64 = await generateSpeech(explanation);
      if (audioBase64) await playAudio(audioBase64);
    } catch (err) { console.error(err); } finally { setIsProcessing(false); }
  };

  const handleExplain = async (text: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: `Explain: "${text.substring(0, 30)}..."`, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    const subjectName = selectedSubject ? t(selectedSubject.nameKey) : '';
    await processAIResponse(text, `Subject: ${subjectName}`);
  };

  const handleAskTaytu = async () => {
    const msgText = inputMessage || "Hello Empress Taytu!"; // Default greeting if empty
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: msgText, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setInputMessage(""); // Clear input
    
    const subjectName = selectedSubject ? t(selectedSubject.nameKey) : 'General Knowledge';
    await processAIResponse(msgText, `Subject: ${subjectName}. The user is asking you directly.`);
  };

  const handleQuiz = async (text: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setQuizActive(true);
    setQuizQuestions([]);
    setQuizAnswers([]);
    
    setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'user', text: "Generate a quiz based on this section.", timestamp: Date.now() }]);

    try {
      const questions = await generateQuiz(text, language);
      setQuizQuestions(questions);
      setQuizAnswers(new Array(questions.length).fill(-1));
      
      setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "I've prepared 3 questions for you. Good luck!", timestamp: Date.now() }]);
    } catch (err) {
      console.error(err);
      setQuizActive(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const submitQuizAnswer = (qIndex: number, optionIndex: number) => {
    const newAnswers = [...quizAnswers];
    newAnswers[qIndex] = optionIndex;
    setQuizAnswers(newAnswers);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setNavStep('VIEWING');
    }
  };

  const selectGrade = (grade: GradeLevel) => {
    setSelectedGrade(grade);
    setNavStep('SUBJECT_SELECT');
  };

  const selectSubject = async (subject: Subject) => {
    setSelectedSubject(subject);
    try {
      const blob = await fetchPdfWithCache(subject.pdfUrl);
      const pdfFile = new File([blob], `${t(subject.nameKey)}.pdf`, { type: "application/pdf" });
      setFile(pdfFile);
      setNavStep('VIEWING');
    } catch (e) {
      console.error("Failed to load PDF", e);
      alert(t('load_pdf_error'));
    }
  };

  const goBack = () => {
    if (navStep === 'VIEWING') {
      setNavStep('SUBJECT_SELECT');
      setFile(null);
      setQuizActive(false);
    } else if (navStep === 'SUBJECT_SELECT') {
      setNavStep('GRADE_SELECT');
      setSelectedGrade(null);
    }
  };
  
  const resetToGradeSelect = () => {
    setMode(AppMode.STUDENT);
    setNavStep('GRADE_SELECT');
    setSelectedGrade(null);
    setSelectedSubject(null);
    setFile(null);
    setQuizActive(false);
  };

  const toggleLanguage = () => {
    setLanguage(prev => {
      if (prev === 'ENGLISH') return 'AMHARIC';
      if (prev === 'AMHARIC') return 'OROMO';
      return 'ENGLISH';
    });
  };

  const getLanguageLabel = () => {
    if (language === 'ENGLISH') return 'EN';
    if (language === 'AMHARIC') return 'አማ';
    return 'ORO';
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 font-sans">
      <nav className="w-20 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-6 space-y-8 z-20">
        <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
          <FileText className="text-white" size={24} />
        </div>
        <div className="flex flex-col space-y-4 w-full items-center">
           <button onClick={resetToGradeSelect} title={t('student_mode')} className={`p-3 rounded-lg transition-all ${mode === AppMode.STUDENT ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
             <School size={24} />
           </button>
           <button onClick={() => setMode(AppMode.PRINCIPAL)} title={t('principal_dashboard')} className={`p-3 rounded-lg transition-all ${mode === AppMode.PRINCIPAL ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
             <AlertCircle size={24} />
           </button>
        </div>
        <div className="mt-auto">
          <button onClick={toggleLanguage} className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${language !== 'ENGLISH' ? 'bg-green-900/30 text-green-400' : 'text-slate-500 hover:text-slate-300'}`}>
             <Languages size={24} />
             <span className="text-[10px] font-bold">{getLanguageLabel()}</span>
           </button>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 flex flex-col min-w-0">
          <header className="mb-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {mode === AppMode.STUDENT && navStep !== 'GRADE_SELECT' && (
                <button onClick={goBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                  <ChevronLeft size={20} />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  {mode === AppMode.PRINCIPAL ? t('principal_dashboard') : t('app_title')} 
                  <span className="text-indigo-500 text-xs uppercase tracking-widest border border-indigo-500/30 px-2 py-0.5 rounded-full">v0.4.2</span>
                </h1>
                <p className="text-slate-400 text-sm">
                  {navStep === 'GRADE_SELECT' ? t('select_grade') : 
                   navStep === 'SUBJECT_SELECT' ? `${t(selectedGrade?.labelKey || '')} - ${t('select_subject')}` :
                   navStep === 'VIEWING' ? `${t(selectedSubject?.nameKey || '')} ${t('textbook')}` : 'Offline-Ready Education'}
                </p>
              </div>
            </div>
            {mode === AppMode.STUDENT && navStep === 'VIEWING' && (
               <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm cursor-pointer transition-colors flex items-center gap-2">
                  <Upload size={16} />
                  <span>{t('custom_pdf')}</span>
                  <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
               </label>
            )}
          </header>

          <div className="flex-1 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/50 backdrop-blur-sm relative">
            {mode === AppMode.PRINCIPAL ? (
              <Dashboard language={language} />
            ) : (
              <>
                {navStep === 'GRADE_SELECT' && (
                  <div className="h-full flex items-center justify-center p-10">
                    <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
                      {CURRICULUM.map(grade => (
                        <button key={grade.id} onClick={() => selectGrade(grade)} className="h-48 rounded-2xl bg-slate-800 hover:bg-indigo-600 transition-all duration-300 group flex flex-col items-center justify-center border border-slate-700 hover:border-indigo-400 shadow-xl">
                          <School size={48} className="text-slate-400 group-hover:text-white mb-4 transition-colors" />
                          <span className="text-2xl font-bold text-slate-200 group-hover:text-white">{t(grade.labelKey)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {navStep === 'SUBJECT_SELECT' && selectedGrade && (
                   <div className="h-full flex items-center justify-center p-10">
                   <div className="grid grid-cols-3 gap-6 w-full max-w-4xl">
                     {selectedGrade.subjects.map(subject => {
                       const Icon = IconMap[subject.iconName] || Layers;
                       return (
                         <button key={subject.id} onClick={() => selectSubject(subject)} className="aspect-square rounded-2xl bg-slate-800 hover:bg-slate-700 transition-all duration-300 group flex flex-col items-center justify-center border border-slate-700 hover:border-indigo-400 shadow-lg">
                           <div className="p-4 rounded-full bg-slate-900/50 group-hover:bg-indigo-500/20 mb-4 transition-colors">
                             <Icon size={32} className="text-indigo-400 group-hover:text-indigo-300" />
                           </div>
                           <span className="text-lg font-semibold text-slate-200 group-hover:text-white">{t(subject.nameKey)}</span>
                           <span className="text-xs text-slate-500 mt-2">{t('ministry_label')}</span>
                         </button>
                       )
                     })}
                   </div>
                 </div>
                )}

                {navStep === 'VIEWING' && (
                  <div className="h-full flex relative">
                    {/* PDF Area */}
                    <div className={`transition-all duration-500 ease-in-out ${quizActive ? 'w-1/2' : 'w-full'}`}>
                      <PDFReader onExplain={handleExplain} onQuiz={handleQuiz} file={file} />
                    </div>
                    
                    {/* Quiz Panel Overlay */}
                    <div className={`absolute right-0 top-0 bottom-0 bg-slate-900/95 border-l border-slate-700 transition-all duration-500 ease-in-out overflow-y-auto ${quizActive ? 'w-1/2 translate-x-0' : 'w-1/2 translate-x-full'}`}>
                       <div className="p-6">
                          <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                              <Brain size={24} className="text-emerald-400" />
                              Pop Quiz
                            </h2>
                            <button onClick={() => setQuizActive(false)} className="p-2 hover:bg-slate-800 rounded-full">
                              <X size={20} />
                            </button>
                          </div>
                          
                          {quizQuestions.length === 0 && (
                            <div className="text-center py-20 text-slate-500 animate-pulse">
                              Generating questions from textbook...
                            </div>
                          )}

                          <div className="space-y-8">
                             {quizQuestions.map((q, qIndex) => (
                               <div key={qIndex} className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                                  <h3 className="font-semibold text-lg mb-4 text-slate-200">{qIndex + 1}. {q.question}</h3>
                                  <div className="space-y-3">
                                    {q.options.map((opt, optIndex) => {
                                      const isSelected = quizAnswers[qIndex] === optIndex;
                                      const isCorrect = q.correctIndex === optIndex;
                                      const showResult = isSelected; 

                                      let btnClass = "w-full text-left p-3 rounded-lg border transition-all ";
                                      if (isSelected) {
                                        if (isCorrect) btnClass += "bg-emerald-500/20 border-emerald-500 text-emerald-200";
                                        else btnClass += "bg-red-500/20 border-red-500 text-red-200";
                                      } else {
                                        btnClass += "bg-slate-900 border-slate-700 hover:bg-slate-700 text-slate-300";
                                      }

                                      return (
                                        <button 
                                          key={optIndex}
                                          onClick={() => submitQuizAnswer(qIndex, optIndex)}
                                          disabled={quizAnswers[qIndex] !== -1}
                                          className={btnClass}
                                        >
                                          <div className="flex justify-between items-center">
                                            <span>{opt}</span>
                                            {isSelected && isCorrect && <Check size={18} />}
                                            {isSelected && !isCorrect && <X size={18} />}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {quizAnswers[qIndex] !== -1 && (
                                    <div className="mt-4 p-3 bg-slate-900/50 rounded-lg text-sm text-slate-400">
                                      <span className="font-bold text-indigo-400">Explanation:</span> {q.explanation}
                                    </div>
                                  )}
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel: The Soul (Avatar & Chat) */}
        <div className="w-96 bg-slate-950 border-l border-slate-800 flex flex-col z-10">
          <div className="p-4 border-b border-slate-800">
             <Avatar analyser={analyserState} />
             <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
               <span className="flex items-center gap-1">
                 <Mic size={12} className={isSpeaking ? "text-red-500 animate-pulse" : ""} /> 
                 STATUS: {isSpeaking ? t('status_speaking') : t('status_listening')}
               </span>
               <span className="font-mono text-indigo-400">GEMINI-2.5-FLASH</span>
             </div>
             
             {/* ASK TAYTU CONTROL */}
             <div className="mt-4 flex flex-col gap-2">
                <button 
                   onClick={handleAskTaytu}
                   disabled={isProcessing}
                   className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:text-indigo-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
                >
                  <Sparkles size={18} />
                  {t('ask_taytu_btn')}
                </button>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {chatHistory.length === 0 && (
               <div className="text-center text-slate-600 mt-10">
                 <p className="text-sm">
                   {navStep === 'VIEWING' ? t('welcome_msg_viewing') : t('welcome_msg_nav')}
                 </p>
               </div>
             )}
             {chatHistory.map((msg) => (
               <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                   msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                 }`}>
                   {msg.text}
                 </div>
               </div>
             ))}
             {isProcessing && (
               <div className="flex justify-start">
                 <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none text-xs text-slate-400 animate-pulse">
                   {t('analyzing')}
                 </div>
               </div>
             )}
             <div ref={chatEndRef} />
          </div>

           {/* TEXT INPUT AREA */}
           <div className="p-3 bg-slate-900 border-t border-slate-800">
             <div className="flex gap-2">
               <input 
                 type="text" 
                 value={inputMessage}
                 onChange={(e) => setInputMessage(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleAskTaytu()}
                 placeholder={t('chat_placeholder')}
                 className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
               />
               <button 
                 onClick={handleAskTaytu}
                 disabled={!inputMessage.trim()}
                 className="p-2 bg-indigo-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500"
               >
                 <Send size={18} />
               </button>
             </div>
           </div>
        </div>
      </main>
    </div>
  );
}

export default App;