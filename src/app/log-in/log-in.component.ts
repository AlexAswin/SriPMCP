import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { CommonModule, NgIf } from '@angular/common';
import { ButtonComponent } from '../Common/button/button.component';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-log-in',
  standalone: true,
  imports: [CommonModule, NgIf, ReactiveFormsModule, MatInputModule, MatButtonModule, MatCardModule, ButtonComponent, RouterModule ],
  templateUrl: './log-in.component.html',
  styleUrl: './log-in.component.scss'
})
export class LogInComponent {
  loginForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router){
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }
  

  onLogin() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      if (email === 'boopathi@gmail.com' && password === '123456') {
        localStorage.setItem('User', 'boopathi')
        this.router.navigate(['/dashBoard']);
      }
      else {
        this.loginForm.markAllAsTouched();
        alert('Login UnSuccessful!');
      }
    } 
  }

  onSignin() {
    this.router.navigate(['/SignIn']);

  }

}
