import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Database, Trash2 } from 'lucide-react';

export function SeedData() {
  const seedMultiSampleData = () => {
    const mockResponses = [
      // Coconut Cheddar Comparison - 5 panelist responses
      {
        id: 'multi_r_1744000001',
        userId: 'panelist_1',
        productId: '7',
        timestamp: '2026-04-10T14:30:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '341',
            cataAttributes: ['Creamy', 'Salty', 'Nutty', 'Smooth'],
            intensityRatings: { sourness: 3, saltiness: 7, bitterness: 2, sweetness: 1, umami: 5 },
            hedonicScores: { overall: 7, appearance: 8, aroma: 7, flavor: 7, texture: 6 },
            emotions: { happy: 4, satisfied: 4, pleased: 3, disappointed: 0, disgusted: 0 }
          },
          {
            sampleId: '2',
            sampleCode: '872',
            cataAttributes: ['Creamy', 'Coconutty', 'Sweet', 'Smooth'],
            intensityRatings: { sourness: 2, saltiness: 5, bitterness: 1, sweetness: 4, umami: 3 },
            hedonicScores: { overall: 6, appearance: 7, aroma: 6, flavor: 5, texture: 7 },
            emotions: { happy: 3, satisfied: 3, pleased: 2, disappointed: 1, disgusted: 0 }
          },
          {
            sampleId: '3',
            sampleCode: '529',
            cataAttributes: ['Creamy', 'Salty', 'Tangy', 'Rich'],
            intensityRatings: { sourness: 5, saltiness: 8, bitterness: 1, sweetness: 0, umami: 7 },
            hedonicScores: { overall: 8, appearance: 8, aroma: 8, flavor: 9, texture: 8 },
            emotions: { happy: 5, satisfied: 5, pleased: 4, nostalgic: 4, disappointed: 0 }
          }
        ],
        differentSample: '872',
        ranking: ['529', '341', '872'],
        sessionType: '3-sample-sequential'
      },
      {
        id: 'multi_r_1744000002',
        userId: 'panelist_2',
        productId: '7',
        timestamp: '2026-04-10T15:15:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '341',
            cataAttributes: ['Salty', 'Nutty', 'Creamy', 'Firm'],
            intensityRatings: { sourness: 2, saltiness: 8, bitterness: 3, sweetness: 1, umami: 6 },
            hedonicScores: { overall: 8, appearance: 7, aroma: 7, flavor: 8, texture: 7 },
            emotions: { happy: 4, satisfied: 4, pleased: 4, interested: 3, disappointed: 0 }
          },
          {
            sampleId: '2',
            sampleCode: '872',
            cataAttributes: ['Sweet', 'Coconutty', 'Soft', 'Creamy'],
            intensityRatings: { sourness: 1, saltiness: 4, bitterness: 0, sweetness: 5, umami: 2 },
            hedonicScores: { overall: 5, appearance: 6, aroma: 5, flavor: 4, texture: 6 },
            emotions: { happy: 2, satisfied: 2, bored: 2, disappointed: 2, disgusted: 0 }
          },
          {
            sampleId: '3',
            sampleCode: '529',
            cataAttributes: ['Tangy', 'Salty', 'Sharp', 'Rich'],
            intensityRatings: { sourness: 6, saltiness: 9, bitterness: 2, sweetness: 0, umami: 8 },
            hedonicScores: { overall: 9, appearance: 8, aroma: 9, flavor: 9, texture: 8 },
            emotions: { happy: 5, satisfied: 5, pleased: 5, nostalgic: 5, enthusiastic: 4 }
          }
        ],
        differentSample: '872',
        ranking: ['529', '341', '872'],
        sessionType: '3-sample-sequential'
      },
      {
        id: 'multi_r_1744000003',
        userId: 'panelist_3',
        productId: '7',
        timestamp: '2026-04-11T10:00:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '341',
            cataAttributes: ['Nutty', 'Creamy', 'Mild'],
            intensityRatings: { sourness: 3, saltiness: 6, bitterness: 2, sweetness: 2, umami: 4 },
            hedonicScores: { overall: 6, appearance: 7, aroma: 6, flavor: 6, texture: 6 },
            emotions: { happy: 3, satisfied: 3, pleased: 3, calm: 3, disappointed: 0 }
          },
          {
            sampleId: '2',
            sampleCode: '872',
            cataAttributes: ['Sweet', 'Coconutty', 'Creamy', 'Artificial'],
            intensityRatings: { sourness: 1, saltiness: 3, bitterness: 1, sweetness: 6, umami: 2 },
            hedonicScores: { overall: 4, appearance: 5, aroma: 4, flavor: 3, texture: 5 },
            emotions: { happy: 1, disappointed: 3, unpleasant: 2, disgusted: 1, bored: 2 }
          },
          {
            sampleId: '3',
            sampleCode: '529',
            cataAttributes: ['Tangy', 'Salty', 'Sharp', 'Creamy', 'Rich'],
            intensityRatings: { sourness: 7, saltiness: 8, bitterness: 1, sweetness: 0, umami: 9 },
            hedonicScores: { overall: 9, appearance: 9, aroma: 8, flavor: 9, texture: 9 },
            emotions: { happy: 5, satisfied: 5, pleased: 5, loving: 4, nostalgic: 5 }
          }
        ],
        differentSample: '872',
        ranking: ['529', '341', '872'],
        sessionType: '3-sample-sequential'
      },
      {
        id: 'multi_r_1744000004',
        userId: 'panelist_4',
        productId: '7',
        timestamp: '2026-04-11T14:30:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '341',
            cataAttributes: ['Creamy', 'Salty', 'Nutty'],
            intensityRatings: { sourness: 2, saltiness: 7, bitterness: 3, sweetness: 1, umami: 5 },
            hedonicScores: { overall: 7, appearance: 7, aroma: 7, flavor: 7, texture: 7 },
            emotions: { happy: 4, satisfied: 4, pleased: 3, comfortable: 3, disappointed: 0 }
          },
          {
            sampleId: '2',
            sampleCode: '872',
            cataAttributes: ['Coconutty', 'Sweet', 'Soft'],
            intensityRatings: { sourness: 2, saltiness: 4, bitterness: 0, sweetness: 5, umami: 2 },
            hedonicScores: { overall: 6, appearance: 6, aroma: 6, flavor: 5, texture: 6 },
            emotions: { happy: 3, satisfied: 2, pleased: 2, bored: 1, disappointed: 1 }
          },
          {
            sampleId: '3',
            sampleCode: '529',
            cataAttributes: ['Tangy', 'Salty', 'Sharp', 'Rich', 'Aged'],
            intensityRatings: { sourness: 6, saltiness: 9, bitterness: 2, sweetness: 0, umami: 8 },
            hedonicScores: { overall: 8, appearance: 8, aroma: 8, flavor: 9, texture: 8 },
            emotions: { happy: 5, satisfied: 5, pleased: 4, enthusiastic: 4, nostalgic: 3 }
          }
        ],
        differentSample: '872',
        ranking: ['529', '341', '872'],
        sessionType: '3-sample-sequential'
      },
      {
        id: 'multi_r_1744000005',
        userId: 'panelist_5',
        productId: '7',
        timestamp: '2026-04-12T09:00:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '341',
            cataAttributes: ['Salty', 'Nutty', 'Creamy', 'Smooth'],
            intensityRatings: { sourness: 3, saltiness: 6, bitterness: 2, sweetness: 2, umami: 5 },
            hedonicScores: { overall: 7, appearance: 8, aroma: 7, flavor: 7, texture: 7 },
            emotions: { happy: 4, satisfied: 4, pleased: 3, calm: 3, disappointed: 0 }
          },
          {
            sampleId: '2',
            sampleCode: '872',
            cataAttributes: ['Sweet', 'Coconutty', 'Creamy'],
            intensityRatings: { sourness: 1, saltiness: 5, bitterness: 1, sweetness: 4, umami: 3 },
            hedonicScores: { overall: 5, appearance: 6, aroma: 5, flavor: 5, texture: 6 },
            emotions: { happy: 2, satisfied: 2, pleased: 2, disappointed: 1, bored: 1 }
          },
          {
            sampleId: '3',
            sampleCode: '529',
            cataAttributes: ['Tangy', 'Salty', 'Sharp', 'Rich'],
            intensityRatings: { sourness: 5, saltiness: 8, bitterness: 1, sweetness: 0, umami: 7 },
            hedonicScores: { overall: 8, appearance: 8, aroma: 8, flavor: 8, texture: 8 },
            emotions: { happy: 4, satisfied: 4, pleased: 4, nostalgic: 4, interested: 3 }
          }
        ],
        differentSample: '872',
        ranking: ['529', '341', '872'],
        sessionType: '3-sample-sequential'
      },

      // Mozzarella Benchmarking - 4 responses
      {
        id: 'multi_r_1744000006',
        userId: 'panelist_6',
        productId: '8',
        timestamp: '2026-04-10T16:00:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '215',
            cataAttributes: ['Mild', 'Creamy', 'Soft', 'Stretchy'],
            intensityRatings: { sourness: 2, saltiness: 4, bitterness: 0, sweetness: 2, umami: 3 },
            hedonicScores: { overall: 7, appearance: 8, aroma: 6, flavor: 7, texture: 8 },
            emotions: { happy: 4, satisfied: 4, pleased: 3, comfortable: 4, disappointed: 0 }
          },
          {
            sampleId: '2',
            sampleCode: '638',
            cataAttributes: ['Tangy', 'Salty', 'Firm', 'Rich'],
            intensityRatings: { sourness: 4, saltiness: 7, bitterness: 1, sweetness: 1, umami: 6 },
            hedonicScores: { overall: 8, appearance: 8, aroma: 8, flavor: 8, texture: 7 },
            emotions: { happy: 5, satisfied: 5, pleased: 4, nostalgic: 4, loving: 3 }
          }
        ],
        differentSample: '638',
        ranking: ['638', '215'],
        sessionType: '3-sample-sequential'
      },
      {
        id: 'multi_r_1744000007',
        userId: 'panelist_7',
        productId: '8',
        timestamp: '2026-04-11T11:30:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '215',
            cataAttributes: ['Mild', 'Creamy', 'Soft'],
            intensityRatings: { sourness: 1, saltiness: 3, bitterness: 0, sweetness: 3, umami: 2 },
            hedonicScores: { overall: 6, appearance: 7, aroma: 6, flavor: 6, texture: 7 },
            emotions: { happy: 3, satisfied: 3, pleased: 3, calm: 3, disappointed: 0 }
          },
          {
            sampleId: '2',
            sampleCode: '638',
            cataAttributes: ['Tangy', 'Salty', 'Rich', 'Aged'],
            intensityRatings: { sourness: 5, saltiness: 8, bitterness: 1, sweetness: 0, umami: 7 },
            hedonicScores: { overall: 9, appearance: 8, aroma: 9, flavor: 9, texture: 8 },
            emotions: { happy: 5, satisfied: 5, pleased: 5, enthusiastic: 4, nostalgic: 5 }
          }
        ],
        differentSample: '638',
        ranking: ['638', '215'],
        sessionType: '3-sample-sequential'
      },
      {
        id: 'multi_r_1744000008',
        userId: 'panelist_8',
        productId: '8',
        timestamp: '2026-04-12T13:00:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '215',
            cataAttributes: ['Mild', 'Creamy', 'Bland'],
            intensityRatings: { sourness: 2, saltiness: 4, bitterness: 0, sweetness: 2, umami: 3 },
            hedonicScores: { overall: 5, appearance: 6, aroma: 5, flavor: 5, texture: 6 },
            emotions: { happy: 2, satisfied: 2, bored: 3, disappointed: 2, unpleasant: 1 }
          },
          {
            sampleId: '2',
            sampleCode: '638',
            cataAttributes: ['Tangy', 'Salty', 'Rich', 'Sharp'],
            intensityRatings: { sourness: 4, saltiness: 7, bitterness: 1, sweetness: 1, umami: 6 },
            hedonicScores: { overall: 8, appearance: 8, aroma: 8, flavor: 8, texture: 7 },
            emotions: { happy: 4, satisfied: 4, pleased: 4, interested: 3, nostalgic: 3 }
          }
        ],
        differentSample: '638',
        ranking: ['638', '215'],
        sessionType: '3-sample-sequential'
      },
      {
        id: 'multi_r_1744000009',
        userId: 'panelist_9',
        productId: '8',
        timestamp: '2026-04-13T10:15:00Z',
        samples: [
          {
            sampleId: '1',
            sampleCode: '215',
            cataAttributes: ['Mild', 'Soft', 'Creamy'],
            intensityRatings: { sourness: 2, saltiness: 5, bitterness: 0, sweetness: 2, umami: 4 },
            hedonicScores: { overall: 7, appearance: 7, aroma: 6, flavor: 7, texture: 7 },
            emotions: { happy: 3, satisfied: 3, pleased: 3, comfortable: 3, calm: 3 }
          },
          {
            sampleId: '2',
            sampleCode: '638',
            cataAttributes: ['Tangy', 'Salty', 'Rich'],
            intensityRatings: { sourness: 5, saltiness: 7, bitterness: 1, sweetness: 1, umami: 6 },
            hedonicScores: { overall: 8, appearance: 8, aroma: 8, flavor: 8, texture: 8 },
            emotions: { happy: 4, satisfied: 4, pleased: 4, loving: 3, nostalgic: 4 }
          }
        ],
        differentSample: '215',
        ranking: ['638', '215'],
        sessionType: '3-sample-sequential'
      }
    ];

    // Save to localStorage
    const responsesKey = 'questionnaire_responses';
    const existingResponses = JSON.parse(localStorage.getItem(responsesKey) || '[]');
    const combined = [...existingResponses, ...mockResponses];
    localStorage.setItem(responsesKey, JSON.stringify(combined));

    alert(`Added ${mockResponses.length} multi-sample responses to localStorage!`);
    window.location.reload();
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all questionnaire data?')) {
      localStorage.removeItem('questionnaire_responses');
      localStorage.removeItem('completed_multi_panelist_1');
      localStorage.removeItem('completed_multi_panelist_2');
      localStorage.removeItem('completed_multi_panelist_3');
      alert('All data cleared!');
      window.location.reload();
    }
  };

  return (
    <Card className="border-2 border-indigo-300">
      <CardHeader className="bg-indigo-50">
        <CardTitle className="flex items-center gap-2">
          <Database className="size-5 text-indigo-600" />
          Developer Tools - Sample Data
        </CardTitle>
        <p className="text-sm text-slate-600">
          Populate the system with mock multi-sample responses for testing
        </p>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <Button onClick={seedMultiSampleData} className="w-full bg-indigo-600 hover:bg-indigo-700">
          <Database className="size-4 mr-2" />
          Seed Multi-Sample Data (9 responses)
        </Button>
        <Button onClick={clearAllData} variant="outline" className="w-full border-rose-300 text-rose-700 hover:bg-rose-50">
          <Trash2 className="size-4 mr-2" />
          Clear All Questionnaire Data
        </Button>
        <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
          <p className="font-semibold mb-1">What this does:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>5 responses for Coconut Cheddar Comparison (Product 7)</li>
            <li>4 responses for Mozzarella Benchmarking (Product 8)</li>
            <li>Includes discrimination test results</li>
            <li>Includes preference rankings</li>
            <li>Includes full sensory data for each sample</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
