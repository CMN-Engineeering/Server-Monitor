const data = Array.from({ length: 5000 }, (_, i) => ({
    index: i,
    value: Math.random()
}));

for(let i = 0; i < 5; i++){
    const start1 = performance.now();
    console.clear();
    const logTime = performance.now() - start1;

    const start2 = performance.now();
    console.table(data);
    console.clear();
    const tableTime = performance.now() - start2;
    
    console.log(tableTime - logTime);
}