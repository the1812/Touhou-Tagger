package main

type App struct{}

func (*App) Hello() string {
	return "Hello from Go!"
}
