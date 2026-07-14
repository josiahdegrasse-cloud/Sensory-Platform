import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useAuth } from '../contexts/auth-context';
import { useActiveProducts, useUserResponses, useConceptTestsForPanelist, useConceptResponses } from '../lib/hooks';
import { CheckCircle2, ClipboardList, Edit2, Layers, AlertCircle, Megaphone, ImageIcon, PackageCheck } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Link } from 'react-router';
import { isPanelistAssignedToProduct } from '../lib/assignments';
import { getBlindStudyCategoryLabel, getBlindStudyDisplayName } from '../lib/blind-study';
import { taskSummary } from '../lib/panelist-box-workflow';

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
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Your tasting tasks</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Welcome, {user?.name}. Match the sample cue before opening each item, then complete the tasks in order.</p>
          </div>
          {user?.panelistId && <span className="shrink-0 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">Panelist <strong className="font-mono text-slate-900">{user.panelistId}</strong></span>}
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm">
          <span><strong className="text-slate-950">{availableProducts.length}</strong> tasting task{availableProducts.length === 1 ? '' : 's'} left</span>
          {availableConceptTests.length > 0 && <span><strong className="text-slate-950">{availableConceptTests.length}</strong> concept task{availableConceptTests.length === 1 ? '' : 's'} left</span>}
          <span className="text-slate-500">{completedProductIds.length + completedConceptIds.length} completed</span>
        </div>
      </header>

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

      {availableProducts.length > 0 && (
        <section aria-labelledby="tasting-box-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
          <h2 id="tasting-box-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <PackageCheck className="size-6 text-slate-500" />
            Your tasting box
          </h2>
          <p className="text-xs text-slate-500">Complete top to bottom</p>
          </div>
          <ol className="overflow-hidden rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
            {availableProducts.map((product, index) => {
              const summary = taskSummary(product);
              return (
              <li key={product.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-950">{summary.label}</h3>{product.blinded && <Badge variant="outline" className="border-slate-300 text-xs text-slate-700">Coded</Badge>}</div>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Find: {summary.sampleCue}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{summary.taskType} · {summary.estimate}{product.isMultiSample && product.samples?.length ? ' · Keep all coded servings together' : ''}</p>
                  </div>
                </div>
                <Button asChild className={`mt-4 h-11 w-full ${index === 0 ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50'}`}><Link to={summary.route}>{product.isMultiSample ? <Layers className="size-4" /> : <ClipboardList className="size-4" />}{index === 0 ? 'Start this task' : `Open task ${index + 1}`}</Link></Button>
              </li>
              );
            })}
          </ol>
        </section>
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
                      <p className="text-xs text-slate-700">{test.category}</p>
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="border-slate-200 text-slate-700 text-xs">Marketing Concept Test</Badge>
                          {test.imageUrls.filter(u => u.trim()).length > 0 && (
                            <Badge variant="outline" className="text-xs border-slate-200 text-slate-700">
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
                      <p className="text-xs text-slate-500 mt-2">
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
                              {product.blinded && <Badge variant="outline" className="border-slate-200 text-slate-700 text-xs">Blinded</Badge>}
                            </div>
                            <p className="text-xs text-slate-700">{categoryLabel}</p>
                          </div>
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                            <CheckCircle2 className="size-4 mr-1" />
                            Complete
                          </Badge>
                        </div>

                        {product.isMultiSample && (
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-slate-200 text-slate-700">
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
                          <p className="text-xs text-slate-700">Editing will update your submitted response. Changes are logged with a new timestamp.</p>
                        </div>
                        <Link to={`/questionnaire/${product.id}`}>
                          <Button variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50">
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
                        <p className="text-xs text-slate-700 mt-1">
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
                      <p className="text-xs text-slate-700">{test.category}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-900 font-medium flex items-center gap-1.5"><CheckCircle2 className="size-4" />Marketing evaluation completed</p>
                    <p className="text-xs text-slate-700 mt-1">Thank you for your feedback on this concept.</p>
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
            <ClipboardList className="size-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No active tasting tasks</h3>
            <p className="text-slate-700">If you just scanned a box QR code, refresh once. If tasks still do not appear, use the issue option on the box pass page or contact the study administrator with your box code.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
