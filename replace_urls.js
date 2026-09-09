const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Replace single-quoted URLs: 'http://localhost:5000/api/...' -> (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/...'
      if (content.includes('\'http://localhost:5000')) {
        content = content.replace(/'http:\/\/localhost:5000(.*?)'/g, "(import.meta.env.VITE_API_URL || 'http://localhost:5000') + '$1'");
        modified = true;
      }
      
      // Replace backtick URLs: `http://localhost:5000/api/...` -> `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/...`
      if (content.includes('`http://localhost:5000')) {
        content = content.replace(/`http:\/\/localhost:5000(.*?)`/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`");
        modified = true;
      }
      
      // Replace double-quoted URLs: "http://localhost:5000" -> import.meta.env.VITE_API_URL || 'http://localhost:5000'
      if (content.includes('"http://localhost:5000"')) {
        content = content.replace(/"http:\/\/localhost:5000"/g, "(import.meta.env.VITE_API_URL || 'http://localhost:5000')");
        modified = true;
      }

      // Handle socket.io specifically: io('http://localhost:5000') -> io(import.meta.env.VITE_API_URL || 'http://localhost:5000')
      // Actually the single quote replacement above covers io('http://localhost:5000') by turning it into io((...) + '') which is fine, 
      // but let's be careful. If it matches 'http://localhost:5000' exactly, it becomes (import.meta.env.VITE_API_URL || 'http://localhost:5000') + ''

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated: ' + fullPath);
      }
    }
  }
}

replaceInDir('frontend/src');
console.log('All frontend API calls parameterized.');
