
import minimist from 'minimist';
import { Main } from './Main';
import { Texture9Utils } from './utils/Texture9Utils';
// ##################

// 输入

const oldArgs = process.argv.slice(2);
const args = minimist(oldArgs);

let main = new Main();
if (oldArgs.length) {
    main.exec(args);
} else {
    // 测试
    main.test();
}

// ##################
