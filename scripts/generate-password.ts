import bcrypt from 'bcrypt';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function hashPassword() {
    const password = await new Promise<string>((resolve) => {
        rl.question('Enter password to hash: ', (answer) => {
            resolve(answer);
        });
    });

    const hash = await bcrypt.hash(password, 10);
    console.log(`Hashed password: (${hash})`);
    rl.close();
}

hashPassword();