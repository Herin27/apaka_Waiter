import { useCallback, useEffect, useState } from 'react';
import { MessageSquareHeart, Star, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { Button, Card, Badge, Input, Select, Skeleton, EmptyState } from '../components/ui';

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [avgOverall, setAvgOverall] = useState(0);
  const [loading, setLoading] = useState(true);
  const [maxRatingFilter, setMaxRatingFilter] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const query = maxRatingFilter ? `?maxRating=${maxRatingFilter}` : '';
      const res = await api.get(`/feedback${query}`);
      setFeedbacks(res.data.data.feedbacks || []);
      setAvgOverall(res.data.data.avgOverall || 0);
    } catch {
      toast.error('Failed to load customer feedback');
    } finally {
      setLoading(false);
    }
  }, [maxRatingFilter]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleSendReply = async (fbId) => {
    const reply = (replyDrafts[fbId] || '').trim();
    if (!reply) return;
    try {
      const res = await api.patch(`/feedback/${fbId}/reply`, { reply });
      setFeedbacks((prev) =>
        prev.map((f) => (f._id === fbId ? res.data.data.feedback : f))
      );
      setReplyDrafts((p) => ({ ...p, [fbId]: '' }));
      toast.success('Reply saved');
    } catch {
      toast.error('Failed to save reply');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <MessageSquareHeart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Guest Feedback Center</h1>
            <p className="text-xs text-zinc-400">
              Average Rating: <strong className="text-amber-400">{avgOverall} ★</strong> ({feedbacks.length} reviews)
            </p>
          </div>
        </div>

        <div className="w-48">
          <Select
            value={maxRatingFilter}
            onChange={(e) => setMaxRatingFilter(e.target.value)}
            options={[
              { value: '', label: 'All Ratings (1–5 ★)' },
              { value: '3', label: 'Low Ratings (≤ 3 ★)' },
              { value: '2', label: 'Critical (≤ 2 ★)' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : feedbacks.length === 0 ? (
        <EmptyState title="No reviews found" description="Customer post-payment ratings appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feedbacks.map((fb) => (
            <Card
              key={fb._id}
              className={`p-5 space-y-3 ${
                fb.rating <= 3 ? 'border-red-500/45 bg-red-500/5' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white">
                    {fb.guestName || 'Guest'}
                  </span>
                  <Badge tone="neutral">Table {fb.tableId?.name || 'N/A'}</Badge>
                </div>

                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < fb.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                {fb.comment || <span className="italic text-zinc-500">No written comment</span>}
              </p>

              <div className="flex gap-3 text-[11px] text-zinc-400">
                <span>Food: {fb.foodRating || fb.rating}★</span>
                <span>Service: {fb.serviceRating || fb.rating}★</span>
                <span>{new Date(fb.createdAt).toLocaleDateString('en-IN')}</span>
              </div>

              {fb.adminReply ? (
                <div className="rounded-xl bg-surface-2 border border-accent/30 p-3 text-xs">
                  <span className="font-bold text-accent">Manager Reply: </span>
                  <span className="text-zinc-200">{fb.adminReply}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="Write manager response..."
                    value={replyDrafts[fb._id] || ''}
                    onChange={(e) =>
                      setReplyDrafts((p) => ({ ...p, [fb._id]: e.target.value }))
                    }
                  />
                  <Button size="sm" variant="primary" onClick={() => handleSendReply(fb._id)}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
