import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Language } from '../types';
import { TRANSLATIONS } from '../translations';
import { TrendingUp, AlertTriangle, CheckCircle, Brain } from 'lucide-react';

interface DashboardProps {
  language: Language;
}

const mockPerformanceData = [
  { month: 'Sep', score: 65 },
  { month: 'Oct', score: 68 },
  { month: 'Nov', score: 72 },
  { month: 'Dec', score: 70 },
  { month: 'Jan', score: 78 },
  { month: 'Feb', score: 82 },
  { month: 'Mar', score: 85 }, // Projection
];

export const Dashboard: React.FC<DashboardProps> = ({ language }) => {
  const t = (key: string) => TRANSLATIONS[language][key] || key;

  return (
    <div className="bg-slate-50 p-6 h-full flex flex-col overflow-y-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
             <Brain className="text-indigo-600" />
             {t('exam_predictor')}
           </h2>
           <p className="text-slate-500">{t('forecast_sub')}</p>
        </div>
        <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg">
           <span className="block text-xs opacity-75">{t('predicted_score')}</span>
           <span className="text-2xl font-bold">85.4%</span>
        </div>
      </div>

      {/* The "Magic" Chart */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 h-64">
        <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">{t('trajectory_analysis')}</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockPerformanceData}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
            <Tooltip 
              contentStyle={{backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none'}}
              itemStyle={{color: '#818cf8'}}
            />
            <Area type="monotone" dataKey="score" stroke="#4f46e5" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 mb-2 text-amber-600">
             <AlertTriangle size={20} />
             <h4 className="font-bold">{t('weakness_title')}</h4>
           </div>
           <p className="text-slate-700 font-medium">Vector Dynamics</p>
           <p className="text-sm text-slate-500 mt-1">
             Student consistently hesitates on 3D vector resolution problems.
             <span className="block mt-2 text-indigo-600 cursor-pointer hover:underline">Start Remedial Session →</span>
           </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 mb-2 text-emerald-600">
             <TrendingUp size={20} />
             <h4 className="font-bold">{t('strength_title')}</h4>
           </div>
           <p className="text-slate-700 font-medium">Thermodynamics</p>
           <p className="text-sm text-slate-500 mt-1">
             Improvement rate is <span className="font-bold text-emerald-600">+15%</span> faster than national average.
           </p>
        </div>
      </div>

      {/* Linguistic Bridge Stats */}
      <div className="mt-6 bg-slate-900 rounded-xl p-5 text-white flex items-center justify-between">
         <div>
            <h4 className="font-bold flex items-center gap-2">
              {t('bridge_active')}
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            </h4>
            <p className="text-slate-400 text-sm mt-1">Translation Layer: Amharic / Oromo</p>
         </div>
         <div className="text-right">
            <span className="text-2xl font-bold">142</span>
            <span className="block text-xs text-slate-400">{t('concepts_translated')}</span>
         </div>
      </div>
    </div>
  );
};
