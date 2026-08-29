const POOL_A = ["Affan", "Harendra", "Tajamul", "Kushagra", "Harsh", "Mayuresh"];
const POOL_B = ["Mohit", "Anand", "Aniket", "Amitesh", "Fadil", "Prayas"];

function roundRobin(players) {
  const arr = [...players];
  if (arr.length % 2 === 1) arr.push(null);

  const n = arr.length;
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const round = [];

    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) round.push([a, b]);
    }

    rounds.push(round);
    arr.splice(1, 0, arr.pop());
  }

  return rounds;
}

function schedule(players) {
  const rounds = roundRobin(players);
  const fixtures = [];

  rounds.forEach((round, ri) => {
    round.forEach((pair) => fixtures.push({ pair, round: ri + 1 }));
  });

  return { rounds, fixtures };
}

const SCHED_A = schedule(POOL_A);
const SCHED_B = schedule(POOL_B);

function standings(players, matches = {}) {
  const table = {};

  players.forEach((name) => {
    table[name] = {
      name, P: 0, W: 0, L: 0, PF: 0, PA: 0, Pts: 0, NRR: 0, PR: 0
    };
  });

  Object.values(matches || {}).forEach((m) => {
    if (!m || !m.done || !Array.isArray(m.pair) || m.pair.length !== 2) return;

    const [a, b] = m.pair;
    if (!table[a] || !table[b]) return;

    const s1 = Number(m.s1);
    const s2 = Number(m.s2);
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 === s2) return;

    table[a].P++;
    table[b].P++;
    table[a].PF += s1;
    table[a].PA += s2;
    table[b].PF += s2;
    table[b].PA += s1;

    if (s1 > s2) {
      table[a].W++;
      table[a].Pts += 2;
      table[b].L++;
    } else {
      table[b].W++;
      table[b].Pts += 2;
      table[a].L++;
    }
  });

  Object.values(table).forEach((r) => {
    r.NRR = r.P > 0 ? (r.PF - r.PA) / r.P : 0;
    r.PR = r.PA > 0 ? r.PF / r.PA : r.PF > 0 ? 99 : 0;
  });

  return Object.values(table).sort(
    (x, y) =>
      y.Pts - x.Pts ||
      y.NRR - x.NRR ||
      y.PR - x.PR ||
      y.PF - x.PF
  );
}

function done(matches, fixtures) {
  return fixtures.every((_, i) => matches?.[`m${i}`]?.done);
}

function poolsDone(state) {
  return done(state.A || {}, SCHED_A.fixtures) &&
         done(state.B || {}, SCHED_B.fixtures);
}

function wildRanking(state) {
  const sA = standings(POOL_A, state.A);
  const sB = standings(POOL_B, state.B);

  return [...sA.slice(3), ...sB.slice(3)].sort(
    (x, y) =>
      y.Pts - x.Pts ||
      y.NRR - x.NRR ||
      y.PR - x.PR ||
      y.PF - x.PF
  );
}

function qfPools(state) {
  const sA = standings(POOL_A, state.A);
  const sB = standings(POOL_B, state.B);
  const wc = wildRanking(state);

  if (sA.length < 3 || sB.length < 3 || wc.length < 2) {
    throw new Error("Not enough standings data to create QF pools.");
  }

  const seeds = [
    sA[0].name, sB[0].name,
    sA[1].name, sB[1].name,
    sA[2].name, sB[2].name,
    wc[0].name, wc[1].name
  ];

  return {
    seeds,
    QA: [seeds[0], seeds[3], seeds[4], seeds[7]],
    QB: [seeds[1], seeds[2], seeds[5], seeds[6]]
  };
}

function knockout(state) {
  const { QA, QB } = qfPools(state);
  const sqa = schedule(QA);
  const sqb = schedule(QB);

  if (!done(state.QA || {}, sqa.fixtures) ||
      !done(state.QB || {}, sqb.fixtures)) {
    return { ready: false, QA, QB, message: "Complete both QF pools first." };
  }

  const sQA = standings(QA, state.QA);
  const sQB = standings(QB, state.QB);

  const semifinalists = [sQA[0].name, sQB[0].name, sQA[1].name, sQB[1].name];

  const result = {
    ready: true,
    semifinalists,
    matches: [
      {
        key: "q1",
        label: "Qualifier 1 — S1 vs S2",
        pair: [semifinalists[0], semifinalists[1]]
      },
      {
        key: "elim",
        label: "Eliminator — S3 vs S4",
        pair: [semifinalists[2], semifinalists[3]]
      }
    ]
  };

  const q1 = state.KO?.q1;
  const elim = state.KO?.elim;

  if (!q1?.done || !elim?.done) return result;

  const q1w = Number(q1.s1) > Number(q1.s2)
    ? result.matches[0].pair[0] : result.matches[0].pair[1];
  const q1l = Number(q1.s1) > Number(q1.s2)
    ? result.matches[0].pair[1] : result.matches[0].pair[0];
  const elw = Number(elim.s1) > Number(elim.s2)
    ? result.matches[1].pair[0] : result.matches[1].pair[1];

  const q2p = [q1l, elw];
  result.matches.push({
    key: "q2",
    label: "Qualifier 2 — Q1 loser vs Elim winner",
    pair: q2p
  });

  const q2 = state.KO?.q2;
  if (!q2?.done) return result;

  const q2w = Number(q2.s1) > Number(q2.s2) ? q2p[0] : q2p[1];
  const finalPair = [q1w, q2w];

  result.matches.push({
    key: "final",
    label: "Grand Final",
    pair: finalPair
  });

  if (state.KO?.final?.done) {
    result.champion =
      Number(state.KO.final.s1) > Number(state.KO.final.s2)
        ? finalPair[0] : finalPair[1];
  }

  return result;
}

function emptyState() {
  return { A: {}, B: {}, QA: {}, QB: {}, KO: {} };
}

function fixturesForStage(stage, state) {
  if (stage === "A") return SCHED_A;
  if (stage === "B") return SCHED_B;

  if (stage === "QA" || stage === "QB") {
    if (!poolsDone(state)) return null;
    const { QA, QB } = qfPools(state);
    return stage === "QA" ? schedule(QA) : schedule(QB);
  }

  return null;
}

module.exports = {
  POOL_A, POOL_B, SCHED_A, SCHED_B,
  roundRobin, schedule, standings, poolsDone,
  wildRanking, qfPools, knockout, emptyState, fixturesForStage
};
