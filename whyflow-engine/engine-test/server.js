const express = require('express');
const app = express();

// Helper to simulate a delay
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function stepFive() {
    console.log("🏁 Chain Complete");
}

async function stepFour() {
    await delay(1000);
    stepFive();
}

async function stepThree() {
    await delay(1000);
    stepFour();
}

async function stepTwo() {
    await delay(1000);
    stepThree();
}

async function stepOne() {
    console.log("🚀 Starting Chain...");
    await delay(1000);
    stepTwo();
}

app.get('/something', (req, res) => {
    stepOne();
    res.send('Chain reaction started! Watch the D3 graph.');
});

app.listen(4000, () => console.log('🚀 Server at http://localhost:4000'));
