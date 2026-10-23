const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../rrhh.html'), 'utf8');
function extract(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a);
  return source.slice(a, b);
}
const context = {labels: {}, esc: String, trialPeriodsByCandidate: {},
  approvedField: () => '', approvedApplicationFields: () => '',
  approvedInterviewSummary: () => '', approvedInterviewRatingSummary: () => ''};
vm.createContext(context);
vm.runInContext(extract('function candidateGuidedFlow(x)', 'function openInitialDecision'), context);
vm.runInContext(extract('function approvedCandidatePanel(', 'function approvedOpenVacancy'), context);
(async () => {
  const statuses = ['new', 'reviewed', 'preselected', 'interview_scheduled', 'interviewed', 'trial', 'hired', 'talent_pool', 'not_selected'];
  for (const status of statuses) {
    const candidate = {id: 'synthetic', full_name: 'Prueba aislada', status};
    const html = context.approvedCandidatePanel(candidate, 'Plaza', [], '', ['Historial conservado'], null);
    for (const [label, handler] of [['Perfilar para otra plaza', 'openReprofile'], ['Pasar a cantera', 'postDecision'], ['No seleccionar', 'postDecision']]) {
      const button = html.match(new RegExp('<button[^>]*>[^<]*' + label + '</button>'))?.[0];
      assert(button, `${status}: ${label}`);
      assert(!button.includes('disabled'), `${status}: ${label} disabled`);
      assert(button.includes(handler));
    }
    assert(html.includes("approvedOpenSection('files')"));
    assert(html.includes("approvedOpenSection('history')"));
    assert(!context.candidateGuidedFlow(candidate).includes('confirm('));
  }
  const updates = [];
  context.candidates = [{id: 'synthetic', status: 'trial'}];
  context.closeDetail = context.render = () => {};
  context.sb = {from(table) { assert.equal(table, 'hr_candidates'); return {update(patch) { updates.push(patch); return {eq: async () => ({error: null})}; }}; }};
  vm.runInContext(extract('async function postDecision(', 'async function toggleTrialForm'), context);
  for (const status of statuses) for (const decision of ['talent_pool', 'not_selected']) {
    context.candidates[0].status = status;
    await context.postDecision('synthetic', decision);
    const patch = updates.at(-1);
    assert.equal(patch.status, decision);
    assert.deepEqual(Object.keys(patch).sort(), ['decision_status', 'decision_updated_at', 'status']);
  }
  const reprofile = extract('async function openReprofile(', 'const inlineInterviewQuestions');
  assert(!reprofile.includes("['hired','trial']"));
  assert(reprofile.includes("update({vacancy_id:v.id,status:'new',decision_status:null,interview_availability_confirmed_at:null})"));
  console.log('PASS: existing actions enabled in all 9 statuses, original handlers, continuity, files/history access, isolated decision updates, existing reprofile flow');
})().catch(error => { console.error(error); process.exitCode = 1; });
