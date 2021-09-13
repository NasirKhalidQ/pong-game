import { interval, fromEvent, from, zip, pipe } from "rxjs";
import { map, scan, filter, flatMap, takeUntil } from "rxjs/operators";

function pong() {
    //this stores the state of the paddle
    type State = Readonly<{
        p1x: number;
        p1y: number;
    }>;
    //a ball class which stores information about the co ordinates and velocity of the ball
    class Ball {
        x: number;
        y: number;
        xVel: number;
        yVel: number;
        constructor(x: number, y: number, yVel: number, xVel: number) {
            this.x = x;
            this.y = y;
            this.xVel = xVel;
            this.yVel = yVel;
        }
    }
    //these constants get the svg elements from the HTML file so that transform can be used on them
    const ballHTML = document.getElementById("ball")!;
    //stores the ball's positions at any given time
    const gameball = new Ball(300, 300, 2, 2);

    const player1 = document.getElementById("player1")!;
    const player2 = document.getElementById("player2")!;

    //these constants get the text elements from the HTML for scores
    const p1score = document.getElementById("p1score")!;
    const p2score = document.getElementById("p2score")!;

    const winner = document.getElementById("winner")!;

    //these magic numbers are constants which will be used throughout the game, they are the magic numbers and provide clarity when doing calculations
    const Constants = new (class {
        readonly CanvasSize = 600;
        readonly PaddleTop = 0;
        readonly PaddleBottom = 530;
        readonly PaddleHeight = 70;
    })();
    //the initial state of the paddle when the game starts
    const paddle1StateInitial: State = {
        p1x: 5,
        p1y: 200,
    };
    //this function returns a new state after doing the necessary adjustments to the co ordinates
    function reduceState(s: State, steps: number): State {
        return {
            ...s,
            p1y: s.p1y + steps,
        };
    }
    //the following code is taken from https://tgdwyer.github.io/asteroids/#pure-observable-streams
    //it creates an Observable from the key press and returns a number which accumulates using scan untill the key press is lifted. That number is then returned
    //to the reduce state function and change the visuals of the HTML using the updatePaddle function. Filter is used to exclude when the current y co ordinates
    //for the paddle exceed the paddle top and paddle bottom. Refresh rate for paddle update is 3ms
    const keys = fromEvent<KeyboardEvent>(document, "keydown")
        .pipe(
            filter(({ code }) => code === "ArrowUp" || code === "ArrowDown"),
            filter(({ repeat }) => !repeat),
            flatMap((d) =>
                interval(3).pipe(
                    takeUntil(
                        fromEvent<KeyboardEvent>(document, "keyup").pipe(
                            filter(({ code }) => code === d.code)
                        )
                    ),
                    map((_) => d)
                )
            ),
            map(({ code }) => (code === "ArrowUp" ? -4 : 4)),
            scan(reduceState, paddle1StateInitial),
            filter(
                ({ p1y }) =>
                    p1y > Constants.PaddleTop && p1y < Constants.PaddleBottom
            )
        )
        .subscribe(updateView);

    //this Observable moves the ball in x and y directions. If the ball is exceeding the top and bottom of the canvas its velocity is reversed and so it appears
    //that is is bouncing from the canvas boundary. This Observable also makes the CPU paddle track the ball's y co ordinates
    const moveBall = interval(5)
        .pipe(
            map(() => {
                gameball.y < 590 && gameball.y > 10
                    ? (gameball.yVel = gameball.yVel)
                    : (gameball.yVel = -gameball.yVel);

                gameball.y += gameball.yVel;
                gameball.x += gameball.xVel;
            })
        )
        .subscribe(() => {
            ballHTML.setAttribute(
                "transform",
                `translate(${gameball.x}, ${gameball.y})`
            );
            player2.setAttribute(
                "y",
                (gameball.y - Constants.PaddleHeight / 2).toString()
            );
        });
    //this function checks for collisions between the ball and the paddle
    function collide(player: Element): boolean {
        return (
            Number(player.getAttribute("x")) <= gameball.x + 10 &&
            Number(player.getAttribute("x")) + 20 >= gameball.x - 10 &&
            Number(player.getAttribute("y")) <= gameball.y + 10 &&
            Number(player.getAttribute("y")) + 70 >= gameball.y - 20
        );
    }
    //this part checks if the ball has collided with either paddles, in which case it reverses the y velocity of the ball so it bounces off the paddles
    interval(5)
        .pipe(
            map(() => {
                return gameball.xVel;
            }),
            filter(() => {
                return collide(player1) || collide(player2);
            })
        )
        .subscribe(() => (gameball.xVel = -gameball.xVel));

    //updates the score on the screen, each player's score is stored in their attribute 'score' in the svg element
    interval(5).subscribe(() => {
        p1score.textContent = player1.getAttribute("score");
        p2score.textContent = player2.getAttribute("score");
    });

    //updates the score in the player 1's 'score' attribute by adding 1 to it each time ball crosses the left x boundary. Checks if the score is equal to 7
    //in which case it displays the text for winner. Resets the ball to the center after a score is added.
    interval(5)
        .pipe(
            map(() => {
                return gameball.x, gameball.y, player1.getAttribute("score");
            }),
            filter(() => {
                return (
                    gameball.x < 0 && Number(player1.getAttribute("score")) <= 6
                );
            })
        )
        .subscribe(() => {
            player1.setAttribute(
                "score",
                (Number(player1.getAttribute("score")) + 1).toString()
            );
            gameball.x = 300;
            gameball.y = 300;
            Number(player1.getAttribute("score")) === 7
                ? (winner.textContent = "Player 1 Won")
                : null;
        });

    //updates the score for CPU
    interval(5)
        .pipe(
            map(() => {
                return gameball.x, gameball.y, player2.getAttribute("score");
            }),
            filter(() => {
                return (
                    gameball.x > 600 &&
                    Number(player2.getAttribute("score")) <= 6
                );
            })
        )
        .subscribe(() => {
            player2.setAttribute(
                "score",
                (Number(player2.getAttribute("score")) + 1).toString()
            );
            gameball.x = 300;
            gameball.y = 300;
            Number(player2.getAttribute("score")) === 7
                ? (winner.textContent = "Player 2 Won")
                : null;
        });
    //this function changes the x y for the players paddle by taking it from the state given as parameter
    function updateView(state: State): void {
        player1.setAttribute("x", state.p1x.toString());
        player1.setAttribute("y", state.p1y.toString());
    }
    //this Observable closes all the subscribes so that the paddle and ball stop moving
    interval(5).subscribe(() => {
        Number(player1.getAttribute("score")) >= 7
            ? (keys.unsubscribe(),
              moveBall.unsubscribe(),
              player2.setAttribute("y", "300"))
            : null;
    });
}

// the following simply runs your pong function on window load.  Make sure to leave it in place.
if (typeof window != "undefined")
    window.onload = () => {
        pong();
    };
