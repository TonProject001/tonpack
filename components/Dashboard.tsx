import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { PackingRecord } from '../types';
import { PlayCircle, Search, Calendar, Package, Bot, Download, X, Link as LinkIcon, Check, Copy } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const records = useLiveQuery(() => db.records.orderBy('timestamp').reverse().toArray());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<PackingRecord | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filteredRecords = records?.filter(r => 
    r.orderId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (selectedRecord) {
      const url = URL.createObjectURL(selectedRecord.videoBlob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [selectedRecord]);

  const downloadVideo = () => {
      if (videoUrl && selectedRecord) {
          const a = document.createElement('a');
          a.href = videoUrl;
          a.download = `order-${selectedRecord.orderId}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      }
  }

  const copyLink = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Packing History</h1>
          <p className="text-slate-500">Manage and review recorded packing sessions.</p>
        </div>
        <div className="relative w-96">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                    <Package className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium">Total Packs</p>
                    <p className="text-2xl font-bold text-slate-800">{records?.length || 0}</p>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                    <Bot className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium">AI Analyzed</p>
                    <p className="text-2xl font-bold text-slate-800">{records?.filter(r => r.aiAnalysis).length || 0}</p>
                </div>
            </div>
             <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                    <Calendar className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium">Latest Pack</p>
                    <p className="text-2xl font-bold text-slate-800">
                        {records && records.length > 0 
                            ? new Date(records[0].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                            : '--:--'}
                    </p>
                </div>
            </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 text-sm font-semibold text-slate-600">Order ID</th>
                        <th className="p-4 text-sm font-semibold text-slate-600">Date & Time</th>
                        <th className="p-4 text-sm font-semibold text-slate-600">Public Link</th>
                        <th className="p-4 text-sm font-semibold text-slate-600">AI Note</th>
                        <th className="p-4 text-sm font-semibold text-slate-600 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredRecords?.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-mono font-medium text-slate-900">{record.orderId}</td>
                            <td className="p-4 text-slate-600 text-sm">
                                {new Date(record.timestamp).toLocaleString()}
                            </td>
                            <td className="p-4 text-slate-600 text-sm">
                                {record.publicUrl ? (
                                    <button 
                                        onClick={() => copyLink(record.publicUrl!, record.id!)}
                                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-2 py-1 rounded border border-blue-100"
                                    >
                                        {copiedId === record.id ? <Check className="w-3 h-3" /> : <LinkIcon className="w-3 h-3" />}
                                        {copiedId === record.id ? 'Copied' : 'Copy Link'}
                                    </button>
                                ) : (
                                    <span className="text-slate-400 text-xs">Not uploaded</span>
                                )}
                            </td>
                            <td className="p-4 text-sm">
                                {record.aiAnalysis ? (
                                    <span className="inline-block bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs border border-purple-100 max-w-xs truncate" title={record.aiAnalysis}>
                                        {record.aiAnalysis}
                                    </span>
                                ) : (
                                    <span className="text-slate-400 italic text-xs">No analysis</span>
                                )}
                            </td>
                            <td className="p-4 text-right">
                                <button 
                                    onClick={() => setSelectedRecord(record)}
                                    className="inline-flex items-center gap-1.5 bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shadow-sm"
                                >
                                    <PlayCircle className="w-4 h-4" /> View
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filteredRecords?.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-12 text-center text-slate-400">
                                No records found. Start packing!
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Video Modal */}
      {selectedRecord && videoUrl && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-black rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                          <Package className="w-5 h-5 text-blue-500" />
                          <h2 className="text-white font-bold text-lg">Order: {selectedRecord.orderId}</h2>
                      </div>
                      <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-white transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="bg-black aspect-video flex items-center justify-center">
                      <video src={videoUrl} controls autoPlay className="max-h-full max-w-full" />
                  </div>

                  <div className="p-6 bg-slate-900 text-white flex gap-6">
                      <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">AI Analysis</h4>
                          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-slate-200 text-sm">
                              {selectedRecord.aiAnalysis || "No AI analysis performed for this record."}
                          </div>
                      </div>
                      <div className="flex flex-col gap-2 justify-end">
                           <div className="text-right">
                                <p className="text-xs text-slate-500">Recorded on</p>
                                <p className="font-mono text-sm">{new Date(selectedRecord.timestamp).toLocaleString()}</p>
                           </div>
                           <button 
                             onClick={downloadVideo}
                             className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                               <Download className="w-4 h-4" /> Download Clip
                           </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};