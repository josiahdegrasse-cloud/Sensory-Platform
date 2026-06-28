import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useAuth } from '../contexts/auth-context';
import { useActiveProducts, useUserResponses, useConceptTestsForPanelist, useConceptResponses } from '../lib/hooks';
import { CheckCircle2, Clock, ClipboardList, Edit2, Layers, AlertCircle, Megaphone, ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Link } from 'react-router';
import { isPanelistAssignedToProduct } from '../lib/assignments';
import { getBlindStudyCategoryLabel, getBlindStudyDisplayName } from '../lib/blind-study';

export function PanelistDashboard() {
  const { user } = useAuth();
  const userId = user?.id ?? ''
  const { data: products = [], isLoading: productsLoading, isError: productsError } = useActiveProducts()
  const { data: userResponses = [], isLoading: responsesLoading, isError: responsesError } = useUserResponses(userId)
  const { data: conceptTests = [], isLoading: conceptsLoading, isError: conceptsError } = useConceptTestsForPanelist(userId)
  const { data: conceptResponses = [], isLoading: conceptResponsesLoading, isError: conceptResponsesError } = useConceptResponses(userId)

  const loading = productsLoading || responsesLoading || conceptsLoading || conceptResponsesLoading
  const fetchError = (productsError || responsesError || conceptsError || conceptResponsesError)
    ? 'Unable to load questionnaires. Please check your connection and refresh the page.'
    : ''

  const assignedProducts = products.filter(product => isPanelistAssignedToProduct(product, userId));
  const completedProductIds = userResponses.map(r => r.productId);
  const availableProducts = assignedProducts.filter(p => !completedProductIds.includes(p.id) && p.status !== 'completed');
  const completedProductsList = assignedProducts.filter(p => completedProductIds.includes(p.id));

  const completedConceptIds = conceptResponses.map(r => r.conceptTestId);
  const availableConceptTests = conceptTests.filter(t => !completedConceptIds.includes(t.id));
  const completedConceptTests = conceptTests.filter(t => completedConceptIds.includes(t.id));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user?.name}!</h1>
        <p className="text-slate-600 mt-2">Panelist ID: <span className="font-bold text-slate-900">{user?.panelistId}</span></p>
        <p className="text-sm text-slate-600 mt-1">Complete questionnaires for active product evaluations below.</p>
      </div>

      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Card className="bg-slate-50">
          <CardContent className="pt-12 pb-12 text-center text-slate-500">Loading questionnaires…</CardContent>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-900">{availableProducts.length}</div>
            <div className="text-sm text-slate-600 mt-1">Food Evaluations Pending</div>
            <div className="text-xs text-slate-400 mt-0.5">of {assignedProducts.length} assigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-900">{availableConceptTests.length}</div>
            <div className="text-sm text-slate-600 mt-1">Marketing Tests Pending</div>
            <div className="text-xs text-slate-400 mt-0.5">of {conceptTests.length} assigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-900">
              {completedProductIds.length + completedConceptIds.length}
            </div>
            <div className="text-sm text-slate-600 mt-1">Completed</div>
            <div className="text-xs text-slate-400 mt-0.5">of {assignedProducts.length + conceptTests.length} total</div>
          </CardContent>
        </Card>
      </div>

      {/* Available Questionnaires */}
      {availableProducts.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="size-6 text-slate-500" />
            Available Questionnaires
          </h2>
          <div className="grid gap-4">
            {availableProducts.map(product => {
              const displayName = getBlindStudyDisplayName(product);
              const categoryLabel = getBlindStudyCategoryLabel(product);
              return (
              <Card key={product.id} className="border border-slate-200 bg-white transition hover:border-slate-400">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {product.isMultiSample ? (
                          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                            <Layers className="size-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                            <ClipboardList className="size-5 text-white" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{displayName}</CardTitle>
                            {product.blinded && <Badge variant="outline" className="border-slate-300 text-slate-700 text-xs">Blinded</Badge>}
                          </div>
                          <p className="text-xs text-slate-600">{categoryLabel}</p>
                        </div>
                      </div>

                      {product.isMultiSample && product.samples ? (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-slate-300 text-slate-700">
                              <Layers className="size-3 mr-1" />
                              Multi-Sample Comparison
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-700 space-y-1">
                            <p className="font-medium flex items-center gap-1.5"><Layers className="size-3.5" />{product.samples.length} Samples to Evaluate</p>
                            <p className="text-xs text-slate-600">+ Discrimination Test + Preference Ranking</p>
                            <p className="text-xs text-slate-500">Est. {15 + (product.samples.length - 3) * 5}-{20 + (product.samples.length - 3) * 5} minutes</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="border-slate-300 text-slate-700">Single Product Evaluation</Badge>
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
                    <Button className="w-full text-base py-6 bg-slate-900 hover:bg-slate-800">
                      {product.isMultiSample ? <Layers className="size-5 mr-2" /> : <ClipboardList className="size-5 mr-2" />}
                      {product.isMultiSample ? 'Begin Comparison Study' : 'Begin Product Evaluation'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Marketing / Concept Tests */}
      {availableConceptTests.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Megaphone className="size-6 text-slate-500" />
            Marketing Evaluations
          </h2>
          <div className="grid gap-4">
            {availableConceptTests.map(test => (
              <Card key={test.id} className="border border-slate-200 bg-white transition hover:border-slate-400">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="size-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{test.name}</CardTitle>
                      </div>
                      <p className="text-xs text-slate-600">{test.category}</p>
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="border-slate-300 text-slate-700 text-xs">Marketing Concept Test</Badge>
                          {test.imageUrls.filter(u => u.trim()).length > 0 && (
                            <Badge variant="outline" className="text-xs border-slate-300 text-slate-700">
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
                    <Button className="w-full text-base py-6 bg-slate-900 hover:bg-slate-800 text-white">
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
            <CheckCircle2 className="size-6 text-slate-500" />
            Completed Questionnaires
          </h2>
          <div className="grid gap-4">
            {completedProductsList.map(product => {
              const response = userResponses.find(r => r.productId === product.id);
              const displayName = getBlindStudyDisplayName(product);
              const categoryLabel = getBlindStudyCategoryLabel(product);
              return (
                <Card key={product.id} className="border border-slate-200 bg-white">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-900">
                            {product.isMultiSample ? (
                              <Layers className="size-5 text-white" />
                            ) : (
                              <CheckCircle2 className="size-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{displayName}</CardTitle>
                              {product.blinded && <Badge variant="outline" className="border-slate-300 text-slate-700 text-xs">Blinded</Badge>}
                            </div>
                            <p className="text-xs text-slate-600">{categoryLabel}</p>
                          </div>
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                            <CheckCircle2 className="size-4 mr-1" />
                            Complete
                          </Badge>
                        </div>

                        {product.isMultiSample && (
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-slate-300 text-slate-700">
                              <Layers className="size-3 mr-1" />
                              Multi-Sample Comparison
                            </Badge>
                          </div>
                        )}

                        {response && (
                          <p className="text-xs text-slate-500 mt-2">
                            <CheckCircle2 className="size-3.5 inline mr-1 text-emerald-600" />Completed {new Date(response.timestamp).toLocaleDateString()} at {new Date(response.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!product.isMultiSample ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-xs text-slate-600">Editing will update your submitted response. Changes are logged with a new timestamp.</p>
                        </div>
                        <Link to={`/questionnaire/${product.id}`}>
                          <Button variant="outline" className="w-full border-slate-300 text-slate-700 hover:bg-slate-50">
                            <Edit2 className="size-4 mr-2" />
                            Edit Response
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-900 font-medium">
                          <CheckCircle2 className="size-4 inline mr-1" />Multi-sample evaluation completed
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
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
              <Card key={test.id} className="border border-slate-200 bg-white">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="size-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{test.name}</CardTitle>
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                          <CheckCircle2 className="size-3 mr-1" /> Complete
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600">{test.category}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-900 font-medium flex items-center gap-1.5"><CheckCircle2 className="size-4" />Marketing evaluation completed</p>
                    <p className="text-xs text-slate-600 mt-1">Thank you for your feedback on this concept.</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !fetchError && availableProducts.length === 0 && completedProductsList.length === 0 && availableConceptTests.length === 0 && completedConceptTests.length === 0 && (
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
