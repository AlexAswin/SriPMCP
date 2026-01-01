import { Routes } from '@angular/router';
import { LogInComponent } from './log-in/log-in.component';
import { DashBoardComponent } from './dash-board/dash-board.component';

export const routes: Routes = [
    { path: '', component: LogInComponent }, 
    { path: 'dashBoard', component: DashBoardComponent },
];
