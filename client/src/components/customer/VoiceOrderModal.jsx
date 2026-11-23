import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Plus, Minus, Trash2, Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Button, Badge } from '../ui';
import { formatCurrency, getLocalizedText } from '../../utils/formatters';
import api from '../../api/axios';

export default function VoiceOrderModal({
  open,
  onClose,
  language = 'en',
  onAddParsedItems,
}) {
  const speechLang =
    language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!open && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  }, [open]);

  const sendTranscriptToAi = async (spokenText) => {
    if (!spokenText.trim()) return;
    setParsing(true);
    try {
      const res = await api.post('/public/ai/parse-order', {
        transcript: spokenText.trim(),
        language: speechLang,
      });
      const parsed = res.data.data.parsedItems || [];
      setDraftItems(parsed);
      if (parsed.length === 0) {
        toast('Could not match dishes clearly — try saying dish names or edit manually.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Voice parser unavailable');
    } finally {
      setParsing(false);
    }
  };

  const startVoiceCapture = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Web Speech API is not supported in this browser. Type your phrase below.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      toast.error('Microphone capture stopped. You can type or retry.');
    };
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      setTranscript(text);
      sendTranscriptToAi(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const updateQty = (idx, delta) => {
    setDraftItems((prev) =>
      prev
        .map((it, i) => (i === idx ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  const handleConfirmAdd = async () => {
    if (!draftItems.length) return;
    await onAddParsedItems(draftItems);
    setDraftItems([]);
    setTranscript('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI Voice Ordering"
      description={`Speak naturally (${speechLang}) — e.g. "Ek paneer tikka aur do cold coffee"`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Button
            variant={listening ? 'danger' : 'primary'}
            size="lg"
            onClick={listening ? () => recognitionRef.current?.stop() : startVoiceCapture}
          >
            {listening ? (
              <>
                <MicOff className="h-5 w-5 animate-pulse" />
                Stop Listening...
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Tap to Speak ({speechLang})
              </>
            )}
          </Button>
        </div>

        {/* Editable Transcript Box (also allows manual test input in headless/desktop browsers) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-300">
            Transcript
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder='Try: "Ek paneer tikka aur do cold coffee"'
              className="flex-1 h-10 rounded-xl bg-surface-2 border border-border-subtle px-3 text-xs text-white"
            />
            <Button
              size="sm"
              variant="secondary"
              loading={parsing}
              onClick={() => sendTranscriptToAi(transcript)}
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Parse
            </Button>
          </div>
        </div>

        {/* Confirmation Card Before Adding to Cart */}
        {draftItems.length > 0 && (
          <div className="rounded-2xl bg-surface-2 border border-accent/45 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-accent">
                Confirm Parsed Items
              </span>
              <Badge tone="orange">
                {draftItems.map((d) => `${d.quantity}× ${getLocalizedText(d.name, language)}`).join(', ')}
              </Badge>
            </div>

            <div className="space-y-2">
              {draftItems.map((it, idx) => (
                <div
                  key={`${it.itemId}_${idx}`}
                  className="flex items-center justify-between rounded-xl bg-surface-1 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-bold text-white">{getLocalizedText(it.name, language)}</p>
                    <p className="text-[11px] text-zinc-400">
                      {formatCurrency(it.price)} • Confidence {Math.round((it.confidence || 0.8) * 100)}%
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQty(idx, -1)}
                      className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center text-zinc-300 cursor-pointer"
                    >
                      {it.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-red-400" /> : <Minus className="h-3.5 w-3.5" />}
                    </button>
                    <span className="w-6 text-center font-extrabold text-white">{it.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(idx, 1)}
                      className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center text-zinc-300 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="primary" size="md" className="w-full" onClick={handleConfirmAdd}>
              <Check className="h-4 w-4" />
              Add All to Shared Cart
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
