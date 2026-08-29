const express = require("express");
const { initFirebase } = require("../firebase");
const { requireAdmin } = require("../middleware/auth");
const {
  POOL_A, POOL_B, SCHED_A, SCHED_B,
  standings, poolsDone, wildRanking, qfPools, knockout,
  emptyState, fixturesForStage
} = require("../tournament");

const router = express.Router();

async function getState() {
  const db = initFirebase();
  const snap = await db.ref("tournament").get();
  return snap.exists() ? (snap.val() || emptyState()) : emptyState();
}

async function saveState(state) {
  const db = initFirebase();
  await db.ref("tournament").set(state);
}

function publicTournament(state) {
  const result = {
    state,
    pools: {
      A: { players: POOL_A, fixtures: SCHED_A.fixtures, standings: standings(POOL_A, state.A) },
      B: { players: POOL_B, fixtures: SCHED_B.fixtures, standings: standings(POOL_B, state.B) }
    }
  };

  if (poolsDone(state)) {
    const { seeds, QA, QB } = qfPools(state);
    result.wildcards = wildRanking(state);
    result.qf = {
      seeds,
      QA: {
        players: QA,
        fixtures: fixturesForStage("QA", state).fixtures,
        standings: standings(QA, state.QA)
      },
      QB: {
        players: QB,
        fixtures: fixturesForStage("QB", state).fixtures,
        standings: standings(QB, state.QB)
      }
    };
    result.ko = knockout(state);
  } else {
    result.ko = { ready: false, message: "Complete Pool A and Pool B first." };
  }

  return result;
}

router.get("/", async (req, res, next) => {
  try {
    res.json(publicTournament(await getState()));
  } catch (err) {
    next(err);
  }
});

router.get("/state", async (req, res, next) => {
  try {
    res.json(await getState());
  } catch (err) {
    next(err);
  }
});

router.get("/standings/:stage", async (req, res, next) => {
  try {
    const state = await getState();
    const stage = req.params.stage.toUpperCase();
    const players = { A: POOL_A, B: POOL_B }[stage];

    if (!players) return res.status(400).json({ error: "Use stage A or B." });

    res.json({ stage, standings: standings(players, state[stage]) });
  } catch (err) {
    next(err);
  }
});

router.get("/wildcards", async (req, res, next) => {
  try {
    const state = await getState();
    if (!poolsDone(state)) {
      return res.status(409).json({ error: "Complete both pool stages first." });
    }
    res.json({ ranking: wildRanking(state) });
  } catch (err) {
    next(err);
  }
});

router.get("/quarter-finals", async (req, res, next) => {
  try {
    const state = await getState();
    if (!poolsDone(state)) {
      return res.status(409).json({ error: "Complete both pool stages first." });
    }

    const qf = qfPools(state);
    res.json({
      ...qf,
      QA: { players: qf.QA, schedule: fixturesForStage("QA", state) },
      QB: { players: qf.QB, schedule: fixturesForStage("QB", state) }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/knockout", async (req, res, next) => {
  try {
    const state = await getState();
    res.json(knockout(state));
  } catch (err) {
    next(err);
  }
});

router.post("/matches/:stage/:matchId", requireAdmin, async (req, res, next) => {
  try {
    const stage = req.params.stage.toUpperCase();
    const matchId = req.params.matchId;
    const { s1, s2 } = req.body || {};

    const score1 = Number(s1);
    const score2 = Number(s2);

    if (!Number.isInteger(score1) || !Number.isInteger(score2) ||
        score1 < 0 || score2 < 0 || score1 === score2) {
      return res.status(400).json({
        error: "Scores must be non-negative integers and ties are not allowed."
      });
    }

    const state = await getState();

    if (!["A", "B", "QA", "QB"].includes(stage)) {
      return res.status(400).json({ error: "Invalid pool stage." });
    }

    const sch = fixturesForStage(stage, state);
    if (!sch) {
      return res.status(409).json({ error: "That stage is not ready yet." });
    }

    const index = Number(matchId.replace(/^m/, ""));
    if (!Number.isInteger(index) || !sch.fixtures[index]) {
      return res.status(404).json({ error: "Match not found." });
    }

    const pair = sch.fixtures[index].pair;
    const previous = state[stage][matchId];

    if (previous?.done) {
      return res.status(409).json({
        error: "Match is already completed. Use PATCH to edit it."
      });
    }

    state[stage][matchId] = {
      s1: score1,
      s2: score2,
      done: true,
      pair
    };

    if (stage === "A" || stage === "B") {
      state.QA = {};
      state.QB = {};
      state.KO = {};
    } else {
      state.KO = {};
    }

    await saveState(state);
    res.status(201).json(publicTournament(state));
  } catch (err) {
    next(err);
  }
});

router.patch("/matches/:stage/:matchId", requireAdmin, async (req, res, next) => {
  try {
    const stage = req.params.stage.toUpperCase();
    const matchId = req.params.matchId;
    const { s1, s2 } = req.body || {};

    const score1 = Number(s1);
    const score2 = Number(s2);

    if (!Number.isInteger(score1) || !Number.isInteger(score2) ||
        score1 < 0 || score2 < 0 || score1 === score2) {
      return res.status(400).json({ error: "Invalid scores." });
    }

    const state = await getState();
    const old = state[stage]?.[matchId];

    if (!old?.done) {
      return res.status(404).json({ error: "Completed match not found." });
    }

    state[stage][matchId] = {
      ...old,
      s1: score1,
      s2: score2,
      done: true
    };

    if (stage === "A" || stage === "B") {
      state.QA = {};
      state.QB = {};
      state.KO = {};
    } else {
      state.KO = {};
    }

    await saveState(state);
    res.json(publicTournament(state));
  } catch (err) {
    next(err);
  }
});

router.post("/knockout/:matchId", requireAdmin, async (req, res, next) => {
  try {
    const matchId = req.params.matchId;
    if (!["q1", "elim", "q2", "final"].includes(matchId)) {
      return res.status(400).json({ error: "Invalid knockout match." });
    }

    const state = await getState();
    const bracket = knockout(state);

    const match = bracket.matches?.find((m) => m.key === matchId);
    if (!match) {
      return res.status(409).json({ error: "That knockout match is not ready." });
    }

    const { s1, s2 } = req.body || {};
    const score1 = Number(s1);
    const score2 = Number(s2);

    if (!Number.isInteger(score1) || !Number.isInteger(score2) ||
        score1 < 0 || score2 < 0 || score1 === score2) {
      return res.status(400).json({ error: "Invalid scores." });
    }

    if (state.KO[matchId]?.done) {
      return res.status(409).json({
        error: "Match is already completed. Use PATCH /api/tournament/knockout/:matchId."
      });
    }

    state.KO[matchId] = {
      s1: score1,
      s2: score2,
      done: true,
      pair: match.pair
    };

    await saveState(state);
    res.status(201).json(publicTournament(state));
  } catch (err) {
    next(err);
  }
});

router.patch("/knockout/:matchId", requireAdmin, async (req, res, next) => {
  try {
    const matchId = req.params.matchId;
    const state = await getState();

    if (!state.KO?.[matchId]?.done) {
      return res.status(404).json({ error: "Completed knockout match not found." });
    }

    const { s1, s2 } = req.body || {};
    const score1 = Number(s1);
    const score2 = Number(s2);

    if (!Number.isInteger(score1) || !Number.isInteger(score2) ||
        score1 < 0 || score2 < 0 || score1 === score2) {
      return res.status(400).json({ error: "Invalid scores." });
    }

    state.KO[matchId].s1 = score1;
    state.KO[matchId].s2 = score2;

    if (matchId === "q1" || matchId === "elim") {
      delete state.KO.q2;
      delete state.KO.final;
    } else if (matchId === "q2") {
      delete state.KO.final;
    }

    await saveState(state);
    res.json(publicTournament(state));
  } catch (err) {
    next(err);
  }
});

router.post("/reset", requireAdmin, async (req, res, next) => {
  try {
    const state = emptyState();
    await saveState(state);
    res.json(publicTournament(state));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
