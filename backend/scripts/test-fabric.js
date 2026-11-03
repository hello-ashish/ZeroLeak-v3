import 'dotenv/config';
import { initFabricGateway, getFabricStatus, closeFabricGateway } from '../src/Services/fabric.service.js';

async function testFabric() {
    console.log('[TEST-FABRIC] Initializing Fabric Gateway connection...');
    await initFabricGateway();
    const status = await getFabricStatus();
    console.log('[TEST-FABRIC] Status:', JSON.stringify(status, null, 2));
    await closeFabricGateway();
    process.exit(0);
}

testFabric().catch(err => {
    console.error('[TEST-FABRIC] Error:', err);
    process.exit(1);
});
