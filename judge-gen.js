const r = await fetch("http://localhost:3000/api/proxy/generate", {
  method: "POST", headers: {"Content-Type":"application/json"},
  body: JSON.stringify({
    participant_id: 101745, cohort_id: 1680, module_id: 337, week_number: 1,
    activity_type: "GoalSetting",
    post_text: "I'm going to go on a walk on Friday around my Estate. I will aim to do this 1-2 times a week",
    display_name: "P8",
  }),
});
const t = await r.text();
console.log("HTTP", r.status);
console.log(t.slice(0, 600));
