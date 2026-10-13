// Switch Generator — плагин для VS Code
// Спрашивает значения и создаёт готовый switch с case для каждого из них.

const vscode = require('vscode');

// Эта функция вызывается, когда VS Code загружает плагин
function activate(context) {
    const command = vscode.commands.registerCommand('switchGen.generate', generateSwitch);
    context.subscriptions.push(command);
}

function deactivate() {}

// Главная функция — вызывается по команде
async function generateSwitch() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    // 1. Спрашиваем у пользователя значения для case
    const input = await vscode.window.showInputBox({
        prompt: 'Значения для case через запятую или пробел. Диапазон пишется так: 1-5',
        placeHolder: '1-3, a, b',
    });
    if (!input) {
        return; // нажали Esc
    }

    // 2. Превращаем введённый текст в список case
    const labels = parseCases(input);
    if (labels.length === 0) {
        vscode.window.showErrorMessage('Не получилось разобрать значения');
        return;
    }

    // 3. Что писать в скобках switch: выделенный текст, слово под курсором или x
    const expression = getExpression(editor);

    // 4. Отступы берём как в текущей строке
    const cursor = editor.selection.active;
    const line = editor.document.lineAt(cursor.line);
    const indent = line.text.substring(0, line.firstNonWhitespaceCharacterIndex);
    const tab = editor.options.insertSpaces ? ' '.repeat(Number(editor.options.tabSize)) : '\t';
    const code = buildSwitch(expression, labels, indent, tab);

    // 5. Вставляем: в пустую строку — вместо неё, иначе — на новую строку под курсором
    await editor.edit(edit => {
        if (line.isEmptyOrWhitespace) {
            edit.replace(line.range, code);
        } else {
            edit.insert(line.range.end, '\n' + code);
        }
    });
}

// Берёт текст, который пользователь выделил, или слово под курсором. Если ничего нет — "x"
function getExpression(editor) {
    if (!editor.selection.isEmpty) {
        return editor.document.getText(editor.selection).trim();
    }
    const range = editor.document.getWordRangeAtPosition(editor.selection.active);
    return range ? editor.document.getText(range) : 'x';
}

// Разбирает "1-3, a, b, a" и возвращает ["1", "2", "3", "'a'", "'b'"]
function parseCases(input) {
    const result = [];
    const seen = new Set(); // что уже добавили: два одинаковых case — ошибка компиляции

    for (const part of input.split(/[,\s]+/)) {
        if (part === '') {
            continue;
        }
        for (const label of toLabels(part)) {
            if (!seen.has(label)) {
                seen.add(label);
                result.push(label);
            }
        }
    }
    return result;
}

// Превращает один кусок текста в один или несколько case
function toLabels(part) {
    // диапазон чисел: 1-5 -> 1, 2, 3, 4, 5 (не больше 100 штук)
    const range = part.match(/^(-?\d+)-(\d+)$/);
    if (range) {
        const from = Number(range[1]);
        const to = Number(range[2]);
        const numbers = [];
        for (let i = from; i <= to && i <= from + 100; i++) {
            numbers.push(String(i));
        }
        return numbers;
    }
    // одна буква — это символ, пишем в кавычках: a -> 'a'
    if (/^[A-Za-z]$/.test(part)) {
        return ["'" + part + "'"];
    }
    // всё остальное (число, имя константы) оставляем как есть
    return [part];
}

// Собирает текст switch
function buildSwitch(expression, labels, indent, tab) {
    const lines = [];
    lines.push(indent + 'switch (' + expression + ') {');
    for (const label of labels) {
        lines.push(indent + tab + 'case ' + label + ':');
        lines.push(indent + tab + tab + 'break;');
    }
    lines.push(indent + tab + 'default:');
    lines.push(indent + tab + tab + 'break;');
    lines.push(indent + '}');
    return lines.join('\n');
}

module.exports = { activate, deactivate };
