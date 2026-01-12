import { StaticAnalyzer } from './analyzer';
import { RuntimeTracer } from './tracer';
import { Instrumenter } from './instrumenter';

// 1. Start the Tracer and expose it globally
const tracer = new RuntimeTracer(8080);
(global as any).tracer = tracer;

// 2. Generate the Static Map (for the Frontend)
const analyzer = new StaticAnalyzer('./test-code');
const projectMap = analyzer.generateProjectMap();
console.log("✅ Project Map Generated");

// 3. Instrument the code (Add the "sensors")
const instrumenter = new Instrumenter('./test-code/**/*.ts');
const jsCode = instrumenter.instrument();

console.log("🚀 Executing Instrumented Code...");

try {
    // Run the instrumented code in this process
    eval(jsCode);

    // 4. Trigger the logic from your sample.ts
    // Assuming sample.ts has startApp() or calculateSum()
    setInterval(() => {
        console.log("\n--- Automatic Trigger ---");
        if (typeof (global as any).startApp === 'function') {
            (global as any).startApp();
        } else if (typeof (global as any).calculateSum === 'function') {
            (global as any).calculateSum(5, 10);
        }
    }, 4000);

} catch (err) {
    console.error("❌ Runtime Error:", err);
}