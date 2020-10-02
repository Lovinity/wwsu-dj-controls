const { task, src, dest, series } = require("gulp");
var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");
var paths = {
	pages: ["src/**/*", "!**/*.ts"],
};

task("copy-src", function () {
	return src(paths.pages).pipe(dest("dist"));
});

task("compile-ts", function () {
	return tsProject.src().pipe(tsProject()).js.pipe(dest("dist"));
});

task("default", series(["copy-src", "compile-ts"]));