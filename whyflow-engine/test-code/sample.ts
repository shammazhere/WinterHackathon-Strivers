// test-code/sample.ts
(global as any).calculateSum = function (a: number, b: number) {
    return a + b;
};

(global as any).startApp = function () {
    console.log("Triggering logic...");
    (global as any).calculateSum(Math.random(), 100);
};