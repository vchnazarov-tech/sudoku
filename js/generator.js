// Sudoku Generator
// generatePuzzle(difficulty) → { puzzle: [81], solution: [81] }
// difficulty: 'easy' | 'medium' | 'hard'

const CLUES = { easy: 40, medium: 32, hard: 26 };

function isValid(grid, row, col, num) {
  for (let c = 0; c < 9; c++)
    if (grid[row][c] === num) return false;
  for (let r = 0; r < 9; r++)
    if (grid[r][col] === num) return false;
  const br = 3 * Math.floor(row / 3), bc = 3 * Math.floor(col / 3);
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (grid[r][c] === num) return false;
  return true;
}

function solve(grid, limit = 2) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        let solutions = 0;
        for (let num = 1; num <= 9; num++) {
          if (isValid(grid, r, c, num)) {
            grid[r][c] = num;
            solutions += solve(grid, limit);
            if (solutions >= limit) { grid[r][c] = 0; return solutions; }
            grid[r][c] = 0;
          }
        }
        return solutions;
      }
    }
  }
  return 1;
}

function generateFullGrid() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  function backtrack() {
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      if (grid[r][c] === 0) {
        const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
        for (const num of nums) {
          if (isValid(grid, r, c, num)) {
            grid[r][c] = num;
            if (backtrack()) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
    return true;
  }
  backtrack();
  return grid;
}

function removeCells(grid, clues) {
  const cells = Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
    .sort(() => Math.random() - 0.5);
  let removed = 0;
  const target = 81 - clues;
  for (const [r, c] of cells) {
    if (removed >= target) break;
    if (grid[r][c] === 0) continue;
    const temp = grid[r][c];
    grid[r][c] = 0;
    const count = solve(grid.map(row => row.slice()));
    if (count !== 1) grid[r][c] = temp;
    else removed++;
  }
  return grid;
}

function generatePuzzle(difficulty = 'medium') {
  const clues = CLUES[difficulty] ?? CLUES.medium;
  const solution2d = generateFullGrid();
  const puzzle2d = removeCells(solution2d.map(r => r.slice()), clues);
  return {
    puzzle:   puzzle2d.flat(),
    solution: solution2d.flat(),
  };
}
