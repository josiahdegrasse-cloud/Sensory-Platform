import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useAuth } from '../contexts/auth-context';
import { type Product, type QuestionnaireResponse } from '../data/mock-users';
import {
  fetchActiveProducts, fetchUserResponses,
  fetchConceptTestsForPanelist, fetchUserConceptResponses,
  type ConceptTest, type ConceptResponse,
} from '../lib/database';
import { CheckCircle2, Clock, ClipboardList, Edit2, Layers, AlertCircle, Megaphone, ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Link } from 'react-router';

export function PanelistDashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [userResponses, setUserResponses] = useState<QuestionnaireResponse[]>([]);
  const [conceptTests, setConceptTests] = useState<ConceptTest[]>([]);
  const [conceptResponses, setConceptResponses] = useState<ConceptResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      fetchActiveProducts(),
      fetchUserResponses(user.id),
      fetchConceptTestsForPanelist(user.id),
      fetchUserConceptResponses(user.id),
    ])
      .then(([prods, responses, concepts, cResponses]) => {
        setProducts(prods);
        setUserResponses(responses);
        setConceptTests(concepts);
        setConceptResponses(cResponses);
      })
      .catch(() => {
        setFetchError('Unable to load questionnaires. Please check your connection and refresh the page.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user?.id]);

  const completedProductIds = userResponses.map(r => r.productId);
  const availableProducts = products.filter(p => !completedProductIds.includes(p.id) && p.status !== 'completed');
  const completedProductsList = products.filter(p => completedProductIds.includes(p.id));

  const completedConceptIds = conceptResponses.map(r => r.conceptTestId);
  const availableConceptTests = conceptTests.filter(t => !completedConceptIds.includes(t.id));
  const completedConceptTests = conceptTests.filter(t => completedConceptIds.includes(t.id));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border-2 border-blue-200">
        <h1 className="text-3xl font-bold text-slate-900">Welcome, {user?.name}!</h1>
        <p className="text-slate-600 mt-2">Panelist ID: <span className="font-bold text-blue-600">{user?.panelistId}</span></p>
        <p className="text-sm text-slate-600 mt-1">Complete questionnaires for active product evaluations below.</p>
      </div>

      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600">{availableProducts.length}</div>
            <div className="text-sm text-slate-600 mt-1">Food Evaluations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-500">{availableConceptTests.length}</div>
            <div className="text-sm text-slate-600 mt-1">Marketing Tests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-600">
              {completedProductIds.length + completedConceptIds.length}
            </div>
            <div className="text-sm text-slate-600 mt-1">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-purple-600">{products.length + conceptTests.length}</div>
            <div className="text-sm text-slate-600 mt-1">Total Assigned</div>
          </CardContent>
        </Card>
      </div>

      {/* Available Questionnaires */}
      {availableProducts.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="size-6 text-blue-600" />
            Available Questionnaires
          </h2>
          <div className="grid gap-4">
            {availableProducts.map(product => (
              <Card key={product.id} className={`border-2 hover:shadow-lg transition-all ${
                product.isMultiSample
                  ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50'
                  : 'border-blue-200 bg-white'
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {product.isMultiSample ? (
                          <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
                            <Layers className="size-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <ClipboardList className="size-5 text-white" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                          </div>
                          <p className="text-xs text-slate-600">{product.category}</p>
                        </div>
                      </div>

                      {product.isMultiSample && product.samples ? (
                        <div className="mt-3 p-3 bg-white/60 rounded-lg border border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-purple-600">
                              <Layers className="size-3 mr-1" />
                              Multi-Sample Comparison
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-700 space-y-1">
                            <p className="font-medium">📊 {product.samples.length} Samples to Evaluate</p>
                            <p className="text-xs text-slate-600">+ Discrimination Test + Preference Ranking</p>
                            <p className="text-xs text-slate-500">Est. {15 + (product.samples.length - 3) * 5}-{20 + (product.samples.length - 3) * 5} minutes</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-blue-600">Single Product Evaluation</Badge>
                          </div>
                          <p className="text-xs text-slate-600">CATA + Intensity + Hedonic + Emotional Response</p>
                          <p className="text-xs text-slate-500 mt-1">Est. 10-15 minutes</p>
                        </div>
                      )}

                      <p className="text-xs text-slate-400 mt-2">Created {new Date(product.createdDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link to={product.isMultiSample ? `/multi-sample-info/${product.id}` : `/questionnaire-info/${product.id}`}>
                    <Button className={`w-full text-base py-6 ${
                      product.isMultiSample
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}>
                      {product.isMultiSample ? <Layers className="size-5 mr-2" /> : <ClipboardList className="size-5 mr-2" />}
                      {product.isMultiSample ? 'Begin Comparison Study' : 'Begin Product Evaluation'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Marketing / Concept Tests */}
      {availableConceptTests.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Megaphone className="size-6 text-orange-500" />
            Marketing Evaluations
          </h2>
          <div className="grid gap-4">
            {availableConceptTests.map(test => (
              <Card key={test.id} className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="size-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{test.name}</CardTitle>
                      </div>
                      <p className="text-xs text-slate-600">{test.category}</p>
                      <div className="mt-3 p-3 bg-white/70 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-orange-500 text-white text-xs">Marketing Concept Test</Badge>
                          {test.imageUrls.filter(u => u.trim()).length > 0 && (
                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                              <ImageIcon className="size-3 mr-1" />
                              {test.imageUrls.filter(u => u.trim()).length} image{test.imageUrls.filter(u => u.trim()).length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        {test.description && (
                          <p className="text-xs text-slate-700 line-clamp-2 mt-1">{test.description}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {test.questions.length} question{test.questions.length !== 1 ? 's' : ''} · Est. {Math.ceil(test.questions.length * 0.6)} min
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Added {new Date(test.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link to={`/concept-survey/${test.id}`}>
                    <Button className="w-full text-base py-6 bg-orange-500 hover:bg-orange-600 text-white">
                      <Megaphone className="size-5 mr-2" />
                      Begin Marketing Evaluation
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Questionnaires */}
      {completedProductsList.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="size-6 text-emerald-600" />
            Completed Questionnaires
          </h2>
          <div className="grid gap-4">
            {completedProductsList.map(product => {
              const response = userResponses.find(r => r.productId === product.id);
              return (
                <Card key={product.id} className={`border-2 ${
                  product.isMultiSample
                    ? 'border-purple-300 bg-gradient-to-br from-emerald-50 to-purple-50'
                    : 'border-emerald-300 bg-emerald-50'
                }`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            product.isMultiSample ? 'bg-purple-600' : 'bg-emerald-600'
                          }`}>
                            {product.isMultiSample ? (
                              <Layers className="size-5 text-white" />
                            ) : (
                              <CheckCircle2 className="size-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{product.name}</CardTitle>
                            </div>
                            <p className="text-xs text-slate-600">{product.category}</p>
                          </div>
                          <Badge className="bg-emerald-600">
                            <CheckCircle2 className="size-4 mr-1" />
                            Complete
                          </Badge>
                        </div>

                        {product.isMultiSample && (
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-purple-600 text-purple-700">
                              <Layers className="size-3 mr-1" />
                              Multi-Sample Comparison
                            </Badge>
                          </div>
                        )}

                        {response && (
                          <p className="text-xs text-slate-500 mt-2">
                            ✓ Completed {new Date(response.timestamp).toLocaleDateString()} at {new Date(response.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!product.isMultiSample ? (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-700">
                          Thank you for your evaluation! You can edit your response if needed.
                        </p>
                        <Link to={`/questionnaire/${product.id}`}>
                          <Button variant="outline" className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                            <Edit2 className="size-4 mr-2" />
                            Edit Response
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-sm text-purple-900 font-medium">
                          ✓ Multi-sample evaluation completed
                        </p>
                        <p className="text-xs text-purple-700 mt-1">
                          Multi-sample evaluations cannot be edited after submission to preserve data integrity
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Marketing Evaluations */}
      {completedConceptTests.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="size-6 text-emerald-600" />
            Completed Marketing Evaluations
          </h2>
          <div className="grid gap-4">
            {completedConceptTests.map(test => (
              <Card key={test.id} className="border-2 border-orange-200 bg-gradient-to-br from-emerald-50 to-orange-50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="size-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{test.name}</CardTitle>
                        <Badge className="bg-emerald-600">
                          <CheckCircle2 className="size-3 mr-1" /> Complete
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600">{test.category}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-900 font-medium">✓ Marketing evaluation completed</p>
                    <p className="text-xs text-orange-700 mt-1">Thank you for your feedback on this concept.</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {loading && (
        <Card className="bg-slate-50">
          <CardContent className="pt-12 pb-12 text-center text-slate-500">Loading questionnaires…</CardContent>
        </Card>
      )}

      {!loading && availableProducts.length === 0 && completedProductsList.length === 0 && availableConceptTests.length === 0 && completedConceptTests.length === 0 && (
        <Card className="bg-slate-50">
          <CardContent className="pt-12 pb-12 text-center">
            <ClipboardList className="size-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No Active Questionnaires</h3>
            <p className="text-slate-600">Check back later for new product evaluations.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
