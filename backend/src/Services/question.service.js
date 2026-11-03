import crypto from "crypto";

export const selectQuestionsByDifficultyRatio = (allQuestions, numRequired) => {
    const numEasy = Math.round(numRequired * 0.4);
    const numMedium = Math.round(numRequired * 0.3);
    const numHard = numRequired - numEasy - numMedium;

    const easyPool = allQuestions.filter(q => (q.difficultyLevel || "").toLowerCase() === 'easy');
    const mediumPool = allQuestions.filter(q => (q.difficultyLevel || "").toLowerCase() === 'medium');
    const hardPool = allQuestions.filter(q => (q.difficultyLevel || "").toLowerCase() === 'hard');

    const selectedQuestions = [];

    const pickRandom = (pool, count, fallbackPools = []) => {
        let picked = 0;

        while (picked < count && pool.length > 0) {
            const idx = crypto.randomInt(0, pool.length);
            selectedQuestions.push(pool[idx]);
            pool.splice(idx, 1);
            picked++;
        }

        let remainingToPick = count - picked;
        if (remainingToPick > 0) {
            for (const fallback of fallbackPools) {
                while (remainingToPick > 0 && fallback.length > 0) {
                    const idx = crypto.randomInt(0, fallback.length);
                    selectedQuestions.push(fallback[idx]);
                    fallback.splice(idx, 1);
                    remainingToPick--;
                }
            }
        }
    };

    // Attempt to satisfy ratios, fallback to other pools if short on a specific difficulty
    pickRandom(easyPool, numEasy, [mediumPool, hardPool]);
    pickRandom(mediumPool, numMedium, [easyPool, hardPool]);
    pickRandom(hardPool, numHard, [mediumPool, easyPool]);

    // Shuffle the final selection so difficulties are mixed
    for (let i = selectedQuestions.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]];
    }

    return selectedQuestions;
};
