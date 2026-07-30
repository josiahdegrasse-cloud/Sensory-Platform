export function calculateWeightedScore(results, categories, weights) {
  const applicable = [...new Set(results.map((item)=>categories[item.id]))];
  const total = applicable.reduce((sum,category)=>sum+weights[category],0);
  const covered = applicable.filter((category)=>results.filter((item)=>categories[item.id]===category).every((item)=>item.status!=='skip')).reduce((sum,category)=>sum+weights[category],0);
  const passed = applicable.filter((category)=>results.filter((item)=>categories[item.id]===category).every((item)=>item.status==='pass')).reduce((sum,category)=>sum+weights[category],0);
  return { coverage:covered/total, truthScore:passed/total };
}
