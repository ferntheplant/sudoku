import { parseArgs } from "node:util";
import { EOL } from "node:os";

type Numbers = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Domain = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type Coord = [Domain, Domain];
type Cell = Numbers | null;
type Row = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];
type Sudoku = [Row, Row, Row, Row, Row, Row, Row, Row, Row];

const DELIMITER = " ";

async function parseGame(path: string): Promise<Sudoku> {
	const file = Bun.file(path);
	const content = await file.text();
	const lines = content.split(EOL).slice(0, -1);

	if (lines.length !== 9) {
		throw new Error("File did not contain exactly 9 lines");
	}

	const rows = lines.map((line) => {
		if (line.length !== 9) {
			throw new Error("File contained a line without exactly 9 characters");
		}
		return line.split("").map((char) => {
			const num = Number.parseInt(char);
			if (!Number.isNaN(num)) {
				return num;
			}
			if (char === DELIMITER) {
				return null;
			}
			throw new Error("File contained non-numeric, non-delimiter character");
		});
	});

	return rows as Sudoku;
}

function compressContents(initialContents: Cell[]): Set<Numbers> {
	const contents = new Set<Numbers>();
	for (const item of initialContents) {
		if (item) {
			contents.add(item);
		}
	}
	return contents;
}

function getRowContents(board: Sudoku, coord: Coord): Cell[] {
	return [...board[coord[0]]];
}

function transpose(matrix: Sudoku): Sudoku {
	// @ts-ignore-error row[colIndex] could be undefined but we know it's not cause square matrix
	return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

function getColumnContents(board: Sudoku, coord: Coord): Cell[] {
	const transposed = transpose(board);
	return [...transposed[coord[1]]];
}

function getSubGridContents(board: Sudoku, coord: Coord): Cell[] {
	const subCoord: [number, number] = [
		Math.floor(coord[0] / 3),
		Math.floor(coord[1] / 3),
	];
	const candidates: Cell[] = [];
	for (const i of [...Array(9).keys()] as Domain[]) {
		const subGridOffset: [number, number] = [Math.floor(i / 3), i % 3];
		const pos = [
			subCoord[0] * 3 + subGridOffset[0],
			subCoord[1] * 3 + subGridOffset[1],
		];
		candidates.push(board[pos[0] as Domain][pos[1] as Domain]);
	}
	return candidates;
}

function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
	return new Set([...a].filter((x) => !b.has(x)));
}

function setIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
	return new Set([...a].filter((x) => b.has(x)));
}

const ALL_NUMBERS = new Set<Numbers>([1, 2, 3, 4, 5, 6, 7, 8, 9]);

function getOptionsForCoord(board: Sudoku, coord: Coord): Numbers[] {
	const row = getRowContents(board, coord);
	const col = getColumnContents(board, coord);
	const sub = getSubGridContents(board, coord);
	const contents = compressContents([...row, ...col, ...sub]);
	const options = setDifference(ALL_NUMBERS, contents);
	return [...options];
}

function getNextEmptyCoord(board: Sudoku): Coord | null {
	for (const i of [...Array(9).keys()] as Domain[]) {
		for (const j of [...Array(9).keys()] as Domain[]) {
			if (board[i][j] === null) {
				return [i, j];
			}
		}
	}
	return null;
}

type Game = {
	solved: boolean;
	board: Sudoku;
};

function solve(game: Game): Game {
	const next = getNextEmptyCoord(game.board);
	if (!next) {
		return { solved: true, board: game.board };
	}
	const options = getOptionsForCoord(game.board, next);
	if (options.length === 0) {
		return game;
	}
	for (const option of options) {
		const newBoard = structuredClone(game.board);
		newBoard[next[0]][next[1]] = option;
		const newGame = { solved: false, board: newBoard };
		const finalGame = solve(newGame);
		if (finalGame.solved) {
			return finalGame;
		}
	}
	return game;
}

function checkFullBoard(board: Sudoku): boolean {
	const next = getNextEmptyCoord(board);
	if (next) {
		return false;
	}

	for (const i of [...Array(9).keys()] as Domain[]) {
		const row = getRowContents(board, [i, 0]);
		const col = getColumnContents(board, [0, i]);
		const sub = getSubGridContents(board, [
			((i * 3) % 9) as Domain,
			((i * 3) % 9) as Domain,
		]);
		const rowAndCol = setIntersection(new Set(row), new Set(col));
		const andSub = setIntersection(new Set(sub), rowAndCol);
		const intersect = setIntersection(ALL_NUMBERS, andSub);
		if (intersect.size !== 9) {
			return false;
		}
	}
	return true;
}

function prettyPrint(board: Sudoku): void {
	for (const i of [...Array(9).keys()] as Domain[]) {
		let row = "";
		for (const j of [...Array(9).keys()] as Domain[]) {
			if (board[i][j] === null) {
				row += "* ";
			} else {
				row += `${board[i][j]?.toString()} `;
			}
		}
		console.log(`${row}`);
	}
}

async function getBoard() {
	const args = parseArgs({
		args: Bun.argv,
		options: {
			file: {
				type: "string",
			},
		},
		allowPositionals: true,
		strict: true,
	});
	const path = args.values.file;
	if (!path) {
		throw new Error("Please provide a file name");
	}
	return await parseGame(path);
}

async function main() {
	let board = await getBoard();
	console.log("Original board");
	prettyPrint(board);
	console.log("-----------------");
	const isBoardPreSolved = checkFullBoard(board);
	if (!isBoardPreSolved) {
		const solvedGame = solve({ solved: false, board });
		if (!solvedGame.solved) {
			console.log("UNSOLVABLE");
		} else {
			board = solvedGame.board;
			console.log("SOLVED");
			prettyPrint(board);
		}
	} else {
		console.log("PRE-SOLVED");
	}
}

await main();
