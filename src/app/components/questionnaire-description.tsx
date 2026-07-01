import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from '../contexts/auth-context';
import { type Product } from '../data/survey-domain';
import { fetchProduct } from '../lib/database';
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, ClipboardList } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { getBlindStudyCategoryLabel, getBlindStudyDisplayName } from '../lib/blind-study';
import { useScrollToTop } from '../lib/use-scroll-to-top';

export function QuestionnaireDescription() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  useScrollToTop(productId);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!productId) return;
    fetchProduct(productId).then(p => { setProduct(p); setLoading(false); }).catch(() => setLoading(false));
  }, [productId]);

  if (loading) return <div className="max-w-4xl mx-auto p-8 text-slate-500">Loading…</div>;

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Product not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const displayName = getBlindStudyDisplayName(product);
  const categoryLabel = getBlindStudyCategoryLabel(product);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-2xl">Questionnaire Information</CardTitle>
          <div className="space-y-1 text-sm text-slate-700">
            <p><strong>{product.blinded ? 'Sample' : 'Product'}:</strong> {displayName}</p>
            <p><strong>Category:</strong> {categoryLabel}</p>
            <p><strong>Your Panelist ID:</strong> {user?.panelistId}</p>
          </div>
        </CardHeader>
      </Card>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-6 text-slate-500" />
            What You'll Be Evaluating
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-700">
            You will evaluate <strong>{displayName}</strong> across four key areas.
            This questionnaire helps us understand the sensory characteristics and consumer appeal of this product.
          </p>

          <div className="grid gap-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
              <div>
                <h4 className="font-bold text-slate-900">Flavor & Aroma Attributes (CATA)</h4>
                <p className="text-sm text-slate-700 mt-1">
                  Check all flavor and aroma attributes you perceive in the sample. Select as many as apply.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
              <div>
                <h4 className="font-bold text-slate-900">Intensity Ratings</h4>
                <p className="text-sm text-slate-700 mt-1">
                  Rate the intensity of key attributes on a scale from 1 (not present) to 5 (extremely intense).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div>
                <h4 className="font-bold text-slate-900">Hedonic Scores</h4>
                <p className="text-sm text-slate-700 mt-1">
                  Rate how much you like or dislike the overall product and specific aspects (appearance, aroma, flavor, texture).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold flex-shrink-0">4</div>
              <div>
                <h4 className="font-bold text-slate-900">Emotional Response</h4>
                <p className="text-sm text-slate-700 mt-1">
                  Indicate which emotions you experience when tasting this product, and how strongly you feel them.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Information */}
      <Card className="border border-slate-200 bg-slate-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="size-5 text-slate-500" />
            Before You Begin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>Estimated Time:</strong> 10-15 minutes
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>You can review your responses</strong> before final submission
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>You can edit your responses</strong> after submission if needed
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>Hover over any attribute</strong> for its definition if you're unsure
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => navigate('/panelist')}
          className="flex-1"
        >
          Back to Dashboard
        </Button>
        <Button
          onClick={() => navigate(`/questionnaire/${productId}`)}
          className="flex-1 bg-slate-900 hover:bg-slate-800"
        >
          <ClipboardList className="size-4 mr-2" />
          Start Questionnaire
        </Button>
      </div>
    </div>
  );
}
