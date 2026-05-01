import { fork } from 'child_process';

const child = fork('./server.js', { stdio: 'inherit', env: { ...process.env, PORT: '3005' } });
child.on('error', err => console.log('Fork Error:', err));
child.on('exit', code => console.log('Exit code:', code));

setTimeout(() => {
    console.log("Killing after 5s");
    child.kill();
}, 5000);
