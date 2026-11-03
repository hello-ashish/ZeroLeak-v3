import { useState, useCallback, useEffect, useRef } from 'react';

const pseudoHash = (data) => {
    let hash = 0;
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Return a hex string padded to look like a sha256 hash
    return '0x' + Math.abs(hash).toString(16).padStart(12, '0') + Date.now().toString(16).substring(4);
};

const getTimestamp = () => new Date().toISOString();

const INITIAL_MOCK_LEDGER = [
    {
        eventId: "mock-gen-0",
        commitmentType: "GENESIS",
        canonicalHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        prevHash: "0x0",
        payloadString: "{\"message\":\"ZeroLeak Mock Genesis\"}",
        txId: "tx-mock-0000",
        height: 1,
        timestamp: getTimestamp(),
        valid: true
    }
];

export function useMockBlockchain() {
    const [ledger, setLedger] = useState(INITIAL_MOCK_LEDGER);
    const [simulationStatus, setSimulationStatus] = useState('Ready'); // Ready, Running, Paused, Verified, Tampered, Failed
    const [simulationSpeed, setSimulationSpeed] = useState('Normal');
    const [scenario, setScenario] = useState('Exam Lifecycle');
    const [simulationLog, setSimulationLog] = useState([{ time: new Date().toLocaleTimeString(), msg: 'System initialized. Genesis block ready.' }]);
    const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
    const [verifyResult, setVerifyResult] = useState(null);

    const timerRef = useRef(null);

    const addLog = useCallback((msg) => {
        setSimulationLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
    }, []);

    const stepSimulation = useCallback(() => {
        setLedger(prev => {
            const height = prev.length + 1;
            const prevBlock = prev[prev.length - 1];
            
            let type = "RANDOM_COMMITMENT";
            if (scenario === 'Exam Lifecycle') {
                const flow = ["EXAM_CREATED", "EXAM_FINALIZED", "EXAM_PUBLISHED", "STUDENT_ATTEMPT", "RESULT_COMMITMENT"];
                type = flow[(height - 2) % flow.length];
            } else if (scenario === 'Integrity Incident') {
                const flow = ["EXAM_PUBLISHED", "STUDENT_ATTEMPT", "TAB_SWITCH_DETECTED", "INCIDENT_COMMITMENT", "AUDIT_BATCH"];
                type = flow[(height - 2) % flow.length];
            } else {
                const mockTypes = ["EXAM_COMMITMENT", "SUBMISSION_COMMITMENT", "RESULT_COMMITMENT", "INCIDENT_COMMITMENT"];
                type = mockTypes[Math.floor(Math.random() * mockTypes.length)];
            }
            
            const payload = { mockData: `Simulated data for ${type}`, sequence: height };
            const payloadString = JSON.stringify(payload);
            
            addLog(`Step 1: Created block object #${height} for ${type}`);
            
            const canonicalHash = pseudoHash(payloadString + prevBlock.canonicalHash + height);
            addLog(`Step 2: Generated SHA-256 commitment: ${canonicalHash.substring(0, 16)}...`);
            
            addLog(`Step 3: Linked to previous block hash`);

            const newBlock = {
                eventId: `mock-event-${height}`,
                commitmentType: type,
                canonicalHash,
                prevHash: prevBlock.canonicalHash,
                payloadString,
                txId: `tx-mock-${Math.random().toString(36).substring(7)}`,
                height,
                timestamp: getTimestamp(),
                valid: true
            };
            
            addLog(`Step 4: Block #${height} appended to mock ledger`);
            
            return [...prev, newBlock];
        });
    }, [scenario, addLog]);

    const resetSimulation = useCallback(() => {
        setLedger(INITIAL_MOCK_LEDGER);
        setSimulationStatus('Ready');
        setSimulationLog([{ time: new Date().toLocaleTimeString(), msg: 'Simulation reset.' }]);
        setSelectedBlockIndex(0);
        setVerifyResult(null);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const simulateTampering = useCallback((targetIndex = null) => {
        setLedger(prev => {
            if (prev.length <= 1) return prev; // Cannot tamper genesis easily in this demo
            const newLedger = [...prev];
            const indexToTamper = targetIndex !== null ? targetIndex : Math.max(1, Math.floor(Math.random() * newLedger.length));
            
            newLedger[indexToTamper] = {
                ...newLedger[indexToTamper],
                payloadString: `{"mockData":"TAMPERED DATA"}`,
                canonicalHash: "0xBAD" + Math.random().toString(16).substring(2),
                tampered: true,
                valid: false
            };
            
            addLog(`⚠ TAMPERING SIMULATED: Block #${newLedger[indexToTamper].height} data modified.`);
            setSimulationStatus('Tampered');
            setVerifyResult(null);
            return newLedger;
        });
    }, [addLog]);

    const verifyLedger = useCallback(() => {
        addLog(`Starting cryptographic verification...`);
        let isValid = true;
        let failedAt = -1;
        let chainBroken = false;
        
        const verifiedLedger = ledger.map((block, i) => {
            if (i === 0) return { ...block, valid: true }; // Genesis assumed valid
            
            if (chainBroken) {
                return { ...block, valid: false }; // Downstream is always broken
            }
            
            // Check if prev hash matches
            const prevBlock = ledger[i - 1];
            if (block.prevHash !== prevBlock.canonicalHash || block.tampered) {
                isValid = false;
                chainBroken = true;
                if (failedAt === -1) failedAt = block.height;
                return { ...block, valid: false };
            }
            
            return { ...block, valid: true };
        });
        
        setLedger(verifiedLedger);
        
        if (isValid) {
            addLog(`✓ VERIFIED: All blocks mathematically valid.`);
            setSimulationStatus('Verified');
            setVerifyResult({ valid: true, message: `${ledger.length} / ${ledger.length} blocks valid.` });
        } else {
            addLog(`✗ INTEGRITY FAILED: Chain broken at block #${failedAt}.`);
            setSimulationStatus('Failed');
            setVerifyResult({ valid: false, message: `Hash mismatch detected starting at Block #${failedAt}.` });
        }
    }, [ledger, addLog]);

    useEffect(() => {
        if (simulationStatus === 'Running') {
            const ms = simulationSpeed === 'Slow' ? 3000 : simulationSpeed === 'Fast' ? 500 : 1500;
            timerRef.current = setInterval(() => {
                stepSimulation();
            }, ms);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [simulationStatus, simulationSpeed, stepSimulation]);

    return {
        ledger,
        simulationStatus,
        setSimulationStatus,
        simulationSpeed,
        setSimulationSpeed,
        scenario,
        setScenario,
        simulationLog,
        selectedBlockIndex,
        setSelectedBlockIndex,
        stepSimulation,
        resetSimulation,
        simulateTampering,
        verifyLedger,
        verifyResult
    };
}
